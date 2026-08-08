/**
 * Modèle réutilisable pour les pages « code promo ».
 *
 * Pour ajouter un nouveau bookmaker :
 *  1. Créer `src/data/bookmakers/<slug>.ts`
 *  2. `export const X = defineBookmaker({ ... })`
 *  3. L'ajouter au tableau `BOOKMAKERS` dans `src/data/bookmakers.ts`
 *
 * La page article (`/codes-promo/$slug`), le hub avec filtres, le maillage
 * interne, le sitemap et tous les JSON-LD (Article, Review, HowTo, FAQPage,
 * BreadcrumbList) sont générés automatiquement à partir de cet objet.
 */

export const BONUS_TYPES = [
  "Bonus de bienvenue",
  "Bonus sur dépôt",
  "Pari gratuit",
  "Cashback",
  "Bonus multi/combiné",
  "Bonus casino",
] as const;
export type BonusType = (typeof BONUS_TYPES)[number];

export type BonusRow = { label: string; value: string };
export type FaqItem = { q: string; a: string };
export type SubSection = { id: string; title: string; paragraphs: string[]; bullets?: string[] };
export type Section = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  sub?: SubSection[];
  /** Encart d'appel à l'action vers les prédictions IA, affiché en fin de section. */
  cta?: { title: string; text: string; label: string };
  /** Tableau comparatif optionnel rendu après les paragraphes. */
  table?: { head: string[]; rows: string[][] };
};

export type Bookmaker = {
  slug: string;
  name: string;
  code: string;
  affiliateUrl: string;
  /** Logo officiel ou favicon du domaine du bookmaker. */
  logoUrl?: string;
  bannerUrl?: string;
  bannerLinkUrl?: string;
  /** Note et volume d'avis uniquement quand ils sont réellement documentés. */
  rating?: number; // /5
  reviewCount?: number;
  accent: string; // couleur de marque (hex, usage décoratif uniquement)
  tagline: string;
  bonusHeadline: string;
  bonusShort: string;
  minDeposit: string;
  licence: string;
  /** Types de bonus pour les filtres du hub. */
  bonusTypes: BonusType[];
  updatedAt: string; // ISO date — dernière vérification éditoriale
  seoTitle: string;
  seoDescription: string;
  /** Points clés affichés en encart « À retenir » sous le hero. */
  keyTakeaways: string[];
  /**
   * AEO/GEO — réponse directe de 40 à 60 mots à la question principale.
   * Affichée juste sous le H1 et exposée en JSON-LD `QAPage` + `speakable`
   * pour être citée par les moteurs de réponse et les assistants génératifs.
   * Générée automatiquement si absente.
   */
  directAnswer?: string;
  intro: string[];
  steps: string[];
  bonusTable: BonusRow[];
  terms: string[];
  sections: Section[];
  pros: string[];
  cons: string[];
  faq: FaqItem[];
  /** Pays couverts par les pages SEO générées automatiquement. */
  countryPageSlugs?: string[];
};

/** Valide/normalise un bookmaker et applique les valeurs par défaut du modèle. */
export function defineBookmaker(input: Bookmaker): Bookmaker {
  return {
    ...input,
    countryPageSlugs: input.countryPageSlugs ?? ["cameroun", "cote-ivoire", "senegal"],
    bonusTypes: input.bonusTypes.length ? input.bonusTypes : ["Bonus de bienvenue"],
    seoTitle: input.seoTitle || `Code promo ${input.name} ${input.code} : ${input.bonusHeadline}`,
    seoDescription:
      input.seoDescription ||
      `Code promo ${input.name} ${input.code} vérifié : ${input.bonusHeadline}. Inscription, conditions, Mobile Money et avis complet.`,
    directAnswer:
      input.directAnswer ||
      `Le code promo ${input.name} est ${input.code}. Il se saisit pendant l'inscription, dans le champ « code promo », et débloque ${input.bonusHeadline.toLowerCase()} à partir de ${input.minDeposit} de dépôt. Le code est gratuit, valable pour les nouveaux joueurs d'Afrique francophone et compatible Mobile Money (Orange Money, MTN, Moov, Wave).`,
  };
}
