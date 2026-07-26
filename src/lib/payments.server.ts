// Logique serveur de créditation après paiement Fapshi.
// Utilisée par le webhook public ET par la vérification manuelle côté app.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { paymentStatus } from "./fapshi.server";

export type CreditOutcome = {
  status: string;
  credited: boolean;
  credits?: number;
  balance?: number;
};

/**
 * Vérifie le statut réel auprès de Fapshi puis crédite l'utilisateur.
 * Idempotent : la créditation n'a lieu que si `credited_at` est nul.
 */
export async function settlePayment(transId: string): Promise<CreditOutcome> {
  const tx = await paymentStatus(transId);

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, credits, amount_xaf, status, credited_at")
    .eq("trans_id", transId)
    .maybeSingle();

  if (!payment) return { status: tx.status, credited: false };

  if (tx.status !== "SUCCESSFUL") {
    if (payment.status !== tx.status) {
      await supabaseAdmin.from("payments").update({ status: tx.status }).eq("id", payment.id);
    }
    return { status: tx.status, credited: false };
  }

  // Sécurité : le montant payé doit couvrir le prix du pack.
  if (Number(tx.amount) < payment.amount_xaf) {
    await supabaseAdmin.from("payments").update({ status: "UNDERPAID" }).eq("id", payment.id);
    return { status: "UNDERPAID", credited: false };
  }

  if (payment.credited_at) {
    return { status: "SUCCESSFUL", credited: false, credits: payment.credits };
  }

  // Verrou d'idempotence : seule la première mise à jour passe.
  const { data: locked } = await supabaseAdmin
    .from("payments")
    .update({ status: "SUCCESSFUL", credited_at: new Date().toISOString() })
    .eq("id", payment.id)
    .is("credited_at", null)
    .select("id")
    .maybeSingle();
  if (!locked) return { status: "SUCCESSFUL", credited: false, credits: payment.credits };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", payment.user_id)
    .maybeSingle();

  const newBalance = (profile?.credits ?? 0) + payment.credits;
  await supabaseAdmin.from("profiles").update({ credits: newBalance }).eq("id", payment.user_id);
  await supabaseAdmin.from("credits_ledger").insert({
    user_id: payment.user_id,
    kind: "topup",
    amount: payment.credits,
    balance_after: newBalance,
    label: `Recharge ${payment.credits} crédits (${payment.amount_xaf} FCFA)`,
  });

  return { status: "SUCCESSFUL", credited: true, credits: payment.credits, balance: newBalance };
}
