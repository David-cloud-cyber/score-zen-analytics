// Tarification en FCFA (XAF) — packs de crédits LiveFoot AI.
//
// Principe : le prix affiché doit couvrir les frais de l'agrégateur Fapshi
// ET laisser une marge nette. On part donc du revenu net souhaité, on ajoute
// les frais, puis on arrondit au palier de 100 FCFA supérieur.

/** Commission Fapshi sur les encaissements Mobile Money / Orange Money. */
export const FAPSHI_FEE_RATE = 0.03;
/** Frais fixes éventuels par transaction (FCFA). */
export const FAPSHI_FEE_FIXED_XAF = 0;
/** Montant minimum accepté par Fapshi. */
export const FAPSHI_MIN_AMOUNT_XAF = 100;

/** Arrondi au palier de 100 FCFA supérieur (montants « propres »). */
function roundUp100(n: number) {
  return Math.ceil(n / 100) * 100;
}

/**
 * Prix client TTC qui garantit `netTarget` FCFA encaissés après frais Fapshi.
 * gross = (net + frais fixes) / (1 - taux)
 */
export function grossFromNet(netTargetXaf: number) {
  const gross = (netTargetXaf + FAPSHI_FEE_FIXED_XAF) / (1 - FAPSHI_FEE_RATE);
  return Math.max(FAPSHI_MIN_AMOUNT_XAF, roundUp100(gross));
}

/** Frais estimés prélevés par Fapshi sur un montant brut. */
export function estimatedFeeXaf(grossXaf: number) {
  return Math.round(grossXaf * FAPSHI_FEE_RATE + FAPSHI_FEE_FIXED_XAF);
}

/** Revenu net estimé après frais. */
export function netRevenueXaf(grossXaf: number) {
  return grossXaf - estimatedFeeXaf(grossXaf);
}

export const XAF = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Formate un montant en FCFA : « 1 400 FCFA ». */
export function formatXaf(amount: number) {
  return `${XAF.format(amount)} FCFA`;
}

export type CreditPack = {
  id: string;
  credits: number;
  /** Revenu net visé (hors frais agrégateur). */
  netTargetXaf: number;
  best?: boolean;
};

/** Catalogue des packs. 1 analyse IA = 2 crédits. */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", credits: 20, netTargetXaf: 1300 },
  { id: "plus", credits: 50, netTargetXaf: 2600, best: true },
  { id: "pro", credits: 150, netTargetXaf: 6500 },
  { id: "max", credits: 500, netTargetXaf: 16000 },
];

export type PricedPack = CreditPack & {
  priceXaf: number;
  priceLabel: string;
  perAnalysisLabel: string;
  feeXaf: number;
  netXaf: number;
};

export function priceOf(pack: CreditPack): PricedPack {
  const priceXaf = grossFromNet(pack.netTargetXaf);
  const analyses = Math.floor(pack.credits / 2);
  return {
    ...pack,
    priceXaf,
    priceLabel: formatXaf(priceXaf),
    perAnalysisLabel: `${XAF.format(Math.round(priceXaf / Math.max(1, analyses)))} FCFA/analyse`,
    feeXaf: estimatedFeeXaf(priceXaf),
    netXaf: netRevenueXaf(priceXaf),
  };
}

export const PRICED_PACKS: PricedPack[] = CREDIT_PACKS.map(priceOf);

export function findPack(id: string): PricedPack | undefined {
  return PRICED_PACKS.find((p) => p.id === id);
}
