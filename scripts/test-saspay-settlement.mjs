import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Execute the production reconciliation code with in-memory provider/database
// adapters. No network, credentials or production writes in this test suite.
async function load(path, bindings) {
  const source = (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/^import .*;\r?$/gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  globalThis.__saspayTests = bindings;
  return import('data:text/javascript;base64,' + Buffer.from(`const {${Object.keys(bindings).join(',')}} = globalThis.__saspayTests;\n${js}`).toString('base64'));
}
const provider = await load('../src/lib/saspay.server.ts', { getConfig: async () => 'test-only', getRuntimeEnv: () => undefined });
let record, session, transaction, grants;
const db = {
  from(table) {
    const filters = []; let patch;
    const query = {
      select() { return query; }, update(value) { patch = value; return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      async maybeSingle() { return execute(); },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
    };
    function execute() {
      const found = table === 'subscriptions' && filters.every(([key, value]) => record[key] === value);
      if (found && patch) Object.assign(record, patch);
      return { data: found ? { ...record } : null, error: null };
    }
    return query;
  },
  async rpc(name) {
    assert.equal(name, 'activate_subscription');
    const activated = record.status !== 'ACTIVE';
    if (activated) { grants++; record.status = 'ACTIVE'; }
    return { data: [{ activated, new_balance: 100 }], error: null };
  },
};
const service = await load('../src/lib/payments.server.ts', {
  ...provider, supabaseAdmin: db,
  findPremiumPlan: () => ({ name: 'Premium Mensuel', interval: 'month' }),
  getSasPaySession: async id => id === session?.id ? session : null,
  findSasPaySession: async match => session && ((match.externalId && provider.sasPayExternalId(session) === match.externalId) || (match.transactionId && provider.sasPaySessionTransactionId(session) === match.transactionId)) ? session : null,
  getSasPayPayment: async id => { assert.equal(id, 'transaction'); return transaction; },
});
function reset() {
  record = { id: 'sub', user_id: 'owner', provider: 'saspay', external_id: 'sub_test', provider_sale_id: 'session', trans_id: null, status: 'PENDING', plan_id: 'premium_monthly', amount_xaf: 5900 };
  session = { id: 'session', metadata: { external_id: 'sub_test' }, transaction: 'transaction', status: 'PAID', amount: '5900', currency: 'XAF' };
  transaction = { id: 'transaction', status: 'SUCCESS', amount: '5901', currency: 'XOF' };
  grants = 0;
}
reset();
assert.equal((await service.settleByExternalId('sub_test','owner')).credited, true);
assert.equal(record.trans_id, 'transaction');
assert.equal(record.provider_sale_id, 'session');
await service.settleByExternalId('sub_test','owner'); assert.equal(grants, 1);
reset(); record.provider_sale_id = null;
assert.equal((await service.settleByExternalId('sub_test','owner')).credited, true);
reset(); record.trans_id = 'session';
assert.equal((await service.settlePaymentOrSubscription('session','owner')).credited, true);
reset();
assert.equal((await service.settlePaymentOrSubscription('session','intruder')).status, 'UNKNOWN'); assert.equal(grants, 0);
reset(); session.transaction = null; session.status = 'PENDING';
assert.equal((await service.settleByExternalId('sub_test','owner')).status, 'PENDING'); assert.equal(grants, 0);
reset(); transaction.status = 'FAILED';
assert.equal((await service.settleByExternalId('sub_test','owner')).status, 'FAILED'); assert.equal(grants, 0);
reset(); transaction.amount = '500';
assert.equal((await service.settleByExternalId('sub_test','owner')).status, 'UNDERPAID'); assert.equal(grants, 0);
reset(); transaction.currency = 'USD';
assert.equal((await service.settleByExternalId('sub_test','owner')).status, 'UNDERPAID'); assert.equal(grants, 0);
reset(); session.status = 'PENDING';
assert.equal((await service.settleByExternalId('sub_test','owner')).status, 'PENDING'); assert.equal(grants, 0);
reset(); session.metadata.external_id = 'sub_other';
await assert.rejects(service.settleByExternalId('sub_test','owner')); assert.equal(grants, 0);
reset();
await Promise.all([service.settleSasPayTransaction(transaction),service.settleByExternalId('sub_test','owner')]); assert.equal(grants,1);
reset(); transaction.status = 'PENDING';
await service.settleSasPayTransaction({id:'transaction',status:'SUCCESS'}); assert.equal(grants,0);
assert.equal(provider.sasPayAmount({id:'t'}), null);
delete globalThis.__saspayTests;
console.log('SasPay: 13 reconciliation/security checks passed.');
