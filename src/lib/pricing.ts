// Tarification en FCFA (XAF) — packs de crédits et abonnements Premium ScoreZen AI.
//
// Principe : le prix affiché doit couvrir les frais de l'agrégateur Fapshi (3%)
// ET laisser une marge nette, arrondi au palier de 100 FCFA supérieur.

export const FAPSHI_FEE_RATE = 0.03;
export const FAPSHI_FEE_FIXED_XAF = 0;
export const FAPSHI_MIN_AMOUNT_XAF = 100;

export const ANALYSIS_COST = 3;

/** Arrondi au palier de 100 FCFA supérieur. */
function roundUp100(n: number) {
  return Math.ceil(n / 100) * 100;
}

/** Prix client TTC garantissant netTargetXaf FCFA après frais Fapshi. */
export function grossFromNet(netTargetXaf: number) {
  const gross = (netTargetXaf + FAPSHI_FEE_FIXED_XAF) / (1 - FAPSHI_FEE_RATE);
  return Math.max(FAPSHI_MIN_AMOUNT_XAF, roundUp100(gross));
}

export function estimatedFeeXaf(grossXaf: number) {
  return Math.round(grossXaf * FAPSHI_FEE_RATE + FAPSHI_FEE_FIXED_XAF);
}

export function netRevenueXaf(grossXaf: number) {
  return grossXaf - estimatedFeeXaf(grossXaf);
}

export const XAF = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatXaf(amount: number) {
  return `${XAF.format(amount)} FCFA`;
}

// ----------------------------------------------------
// 1. Catalogue des Abonnements Premium
// ----------------------------------------------------
export type PremiumPlan = {
  id: "premium_monthly" | "premium_yearly";
  name: string;
  priceXaf: number;
  interval: "month" | "year";
  monthlyCredits: number;
  badge?: string;
  description: string;
};

export const PREMIUM_PLANS: PremiumPlan[] = [
  {
    id: "premium_monthly",
    name: "Premium Mensuel",
    priceXaf: 4900,
    interval: "month",
    monthlyCredits: 100,
    description: "100 crédits/mois remis à niveau à chaque renouvellement.",
  },
  {
    id: "premium_yearly",
    name: "Premium Annuel",
    priceXaf: 49000,
    interval: "year",
    monthlyCredits: 100,
    badge: "2 mois offerts",
    description: "Economisez 17% (2 mois gratuits). 100 crédits crédités chaque mois.",
  },
];

export function findPremiumPlan(id: string): PremiumPlan | undefined {
  return PREMIUM_PLANS.find((p) => p.id === id);
}

// ----------------------------------------------------
// 2. Catalogue des Packs de Crédits (Réservé aux membres Premium)
// ----------------------------------------------------
export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  netTargetXaf: number;
  best?: boolean;
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", name: "Pack Starter", credits: 15, netTargetXaf: 1625 },
  { id: "plus", name: "Pack Plus", credits: 35, netTargetXaf: 3250, best: true },
  { id: "pro", name: "Pack Pro", credits: 100, netTargetXaf: 8125 },
  { id: "max", name: "Pack Max", credits: 280, netTargetXaf: 20000 },
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
  const analyses = Math.floor(pack.credits / ANALYSIS_COST);
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
