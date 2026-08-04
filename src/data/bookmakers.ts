/**
 * Contenu statique des pages « Codes promo » partenaires.
 *
 * Pour ajouter un bookmaker : copier un objet, changer les valeurs.
 * La page hub, la page article et le sitemap se mettent à jour automatiquement.
 */

export type BonusRow = { label: string; value: string };
export type FaqItem = { q: string; a: string };
export type Section = { id: string; title: string; paragraphs: string[]; bullets?: string[] };

export type Bookmaker = {
  slug: string;
  name: string;
  code: string;
  affiliateUrl: string;
  bannerUrl?: string;
  bannerLinkUrl?: string;
  rating: number; // /5
  reviewCount: number;
  accent: string; // couleur de marque (hex, usage décoratif uniquement)
  tagline: string;
  bonusHeadline: string;
  bonusShort: string;
  minDeposit: string;
  licence: string;
  updatedAt: string; // ISO date — dernière vérification éditoriale
  seoTitle: string;
  seoDescription: string;
  intro: string[];
  steps: string[];
  bonusTable: BonusRow[];
  terms: string[];
  sections: Section[];
  pros: string[];
  cons: string[];
  faq: FaqItem[];
};

export const BOOKMAKERS: Bookmaker[] = [
  {
    slug: "1win",
    name: "1win",
    code: "PREDAT",
    affiliateUrl: "https://lkfg.pro/a66a894d",
    bannerUrl:
      "https://1win-partners.com/promo-files-uploads/c8c82177bd1b0128295928c8571f3b8c3b2e4bb56ad85ca8f0.jpg",
    bannerLinkUrl: "https://one-vv0931.com/?p=iezl",
    rating: 4.6,
    reviewCount: 412,
    accent: "#0b7cff",
    tagline: "Bonus de bienvenue jusqu'à 130 000 FCFA sur les 4 premiers dépôts",
    bonusHeadline: "Jusqu'à 130 000 FCFA de bonus",
    bonusShort: "+500 % répartis sur les 4 premiers dépôts",
    minDeposit: "1 000 FCFA",
    licence: "Curaçao",
    updatedAt: "2026-08-04",
    seoTitle: "Code promo 1win PREDAT : 130 000 FCFA de bonus (2026)",
    seoDescription:
      "Code promo 1win PREDAT : jusqu'à 130 000 FCFA de bonus de bienvenue sur vos 4 premiers dépôts. Inscription pas à pas, conditions, retraits Mobile Money et avis complet.",
    intro: [
      "Le code promo 1win PREDAT débloque le bonus de bienvenue maximal du bookmaker : jusqu'à 130 000 FCFA répartis sur vos quatre premiers dépôts, soit +500 % de votre mise de départ. Il s'agit de l'offre la plus généreuse disponible actuellement sur le marché africain francophone.",
      "Ce code est à saisir au moment de la création du compte, dans le champ prévu à cet effet. Il est valable pour tous les nouveaux inscrits majeurs et fonctionne aussi bien sur le site que sur l'application mobile Android et iOS. Il ne peut pas être ajouté après l'ouverture du compte : c'est le seul point de vigilance réel.",
      "Chez LiveFoot AI, nous utilisons quotidiennement les cotes 1win pour confronter nos analyses IA au marché. Cette page détaille l'offre, les conditions de mise, les moyens de paiement Mobile Money et notre avis honnête sur la plateforme, points faibles compris.",
    ],
    steps: [
      "Cliquez sur le bouton « Récupérer le bonus » de cette page pour ouvrir 1win dans un nouvel onglet.",
      "Sélectionnez « Inscription » puis la méthode « En un clic », « Par téléphone » ou « Par e-mail ».",
      "Choisissez le pays et la devise FCFA (XOF ou XAF selon votre zone).",
      "Saisissez le code promo PREDAT dans le champ « Code promo ». Vérifiez qu'il s'affiche bien avant de valider.",
      "Confirmez l'inscription, puis effectuez un premier dépôt d'au moins 1 000 FCFA par Mobile Money, carte ou crypto.",
      "Le bonus est crédité instantanément sur votre solde bonus, prêt à être converti selon les conditions ci-dessous.",
    ],
    bonusTable: [
      { label: "Code promo", value: "PREDAT" },
      { label: "Montant maximal", value: "130 000 FCFA" },
      { label: "Répartition", value: "4 premiers dépôts (200 % / 150 % / 100 % / 50 %)" },
      { label: "Dépôt minimum", value: "1 000 FCFA" },
      { label: "Conditions de mise", value: "Paris combinés, cote minimale 3.00 par sélection" },
      { label: "Délai d'utilisation", value: "30 jours après le crédit du bonus" },
      { label: "Sports éligibles", value: "Tous, football inclus" },
      { label: "Application mobile", value: "Android (APK) et iOS" },
      { label: "Devise", value: "FCFA (XOF / XAF)" },
    ],
    terms: [
      "Offre réservée aux nouveaux clients majeurs (18 ans et plus), un seul compte par personne, par foyer et par adresse IP.",
      "Le code promo doit obligatoirement être saisi pendant l'inscription : il ne peut pas être appliqué rétroactivement.",
      "Le bonus se libère progressivement en jouant des paris combinés d'au moins 5 sélections cotées à 1.40 minimum chacune.",
      "Les paris remboursés, annulés ou cash-out ne comptent pas dans le déblocage du bonus.",
      "Le solde bonus n'est pas retirable tant que les conditions de mise ne sont pas remplies.",
      "1win se réserve le droit de demander une vérification d'identité (KYC) avant tout retrait important.",
    ],
    sections: [
      {
        id: "quest-ce-que",
        title: "Qu'est-ce que le code promo 1win PREDAT ?",
        paragraphs: [
          "PREDAT est un code partenaire officiel négocié pour les utilisateurs de LiveFoot AI. Il ne coûte rien, ne modifie pas les cotes proposées et n'entraîne aucune obligation supplémentaire : il porte simplement le bonus de bienvenue au maximum autorisé par le bookmaker.",
          "Sans code, un nouvel inscrit obtient l'offre standard, nettement plus faible. Avec PREDAT, le pourcentage de bonus s'applique sur les quatre premiers dépôts au lieu du seul dépôt initial, ce qui change complètement la valeur de l'offre pour un joueur régulier.",
        ],
        bullets: [
          "Validité : permanente, mise à jour vérifiée le 4 août 2026",
          "Zone : Afrique francophone (Cameroun, Côte d'Ivoire, Sénégal, Burkina, Mali, Bénin, Togo, RDC…)",
          "Cumulable avec les promotions récurrentes du bookmaker",
        ],
      },
      {
        id: "promotions",
        title: "Offres et promotions permanentes",
        paragraphs: [
          "Au-delà du bonus de bienvenue, 1win propose un programme promotionnel actif toute l'année. Ces offres restent accessibles après l'épuisement du bonus initial et constituent une bonne partie de l'intérêt de la plateforme sur la durée.",
        ],
        bullets: [
          "Cashback hebdomadaire sur les pertes nettes, crédité chaque lundi",
          "Express Bonus : majoration progressive des gains sur les combinés de 5 sélections et plus",
          "Assurance pari : sécurisez tout ou partie d'une mise contre une fraction du montant",
          "Promotions événementielles pendant la Ligue des champions, la CAN et les grands championnats",
          "Programme de fidélité avec paliers et cadeaux",
        ],
      },
      {
        id: "paiements",
        title: "Dépôts et retraits en FCFA",
        paragraphs: [
          "C'est le point fort de 1win en Afrique francophone : le Mobile Money est intégré nativement, sans passer par un intermédiaire. Les dépôts sont instantanés, et les retraits sont traités en général en moins de 15 minutes en heures ouvrées, jusqu'à 24 heures en cas de vérification.",
          "Aucune commission n'est prélevée par le bookmaker sur les dépôts. Les frais éventuels proviennent uniquement de l'opérateur Mobile Money.",
        ],
        bullets: [
          "Orange Money, MTN Mobile Money, Moov Money, Wave",
          "Cartes Visa et Mastercard",
          "Cryptomonnaies : Bitcoin, USDT, Ethereum",
          "Dépôt minimum : 1 000 FCFA — retrait minimum : 2 000 FCFA",
        ],
      },
      {
        id: "application",
        title: "Application mobile 1win",
        paragraphs: [
          "L'application est disponible en APK pour Android (téléchargeable depuis le site officiel, l'app n'étant pas sur le Play Store) et sur l'App Store pour iOS. Elle est plus légère que le site mobile et gère les notifications de but en temps réel, ce qui la rend nettement plus confortable pour le live.",
          "Le code promo PREDAT fonctionne à l'identique lors d'une inscription depuis l'application.",
        ],
      },
      {
        id: "securite",
        title: "Sécurité, licence et service client",
        paragraphs: [
          "1win opère sous licence Curaçao. Les connexions sont chiffrées en SSL et la vérification d'identité est demandée avant les retraits significatifs, ce qui est une pratique standard et un signe de sérieux plutôt qu'un obstacle.",
          "Le support est joignable 24h/24 par chat en direct sur le site, par e-mail et via Telegram. Les réponses en français sont rapides sur le chat, plus lentes par e-mail.",
        ],
      },
      {
        id: "avis",
        title: "Notre avis sur 1win",
        paragraphs: [
          "1win se distingue par un bonus de bienvenue très au-dessus de la moyenne du marché et par une intégration Mobile Money réellement fonctionnelle, ce qui reste rare. La couverture football est complète : Ligue 1, Premier League, Liga, Serie A, Bundesliga, Ligue des champions, mais aussi championnats africains et compétitions mineures avec un bon volume de marchés en direct.",
          "En contrepartie, les conditions de mise du bonus exigent des combinés à cote élevée, ce qui n'est pas adapté à un joueur prudent qui préfère les paris simples. L'absence de l'application sur le Play Store peut aussi désarçonner les débutants. En résumé : excellent rapport bonus/facilité de paiement, à condition d'accepter des conditions de déblocage exigeantes.",
        ],
      },
    ],
    pros: [
      "Bonus de bienvenue jusqu'à 130 000 FCFA, parmi les plus élevés du marché",
      "Mobile Money intégré : Orange, MTN, Moov, Wave",
      "Retraits rapides, souvent sous 15 minutes",
      "Large couverture football, y compris championnats africains",
      "Support 24h/24 en français",
    ],
    cons: [
      "Conditions de mise exigeantes (combinés à cote minimale)",
      "Application Android à installer manuellement en APK",
      "Licence Curaçao, moins protectrice qu'une licence européenne",
    ],
    faq: [
      {
        q: "Quel est le code promo 1win en 2026 ?",
        a: "Le code promo 1win actuel est PREDAT. Il donne accès au bonus de bienvenue maximal, soit jusqu'à 130 000 FCFA répartis sur les quatre premiers dépôts.",
      },
      {
        q: "Le code promo 1win est-il gratuit ?",
        a: "Oui, totalement. Le code PREDAT est gratuit et n'engendre aucun frais. Il augmente simplement le montant du bonus offert à l'inscription.",
      },
      {
        q: "Où saisir le code promo PREDAT ?",
        a: "Dans le formulaire d'inscription, au champ « Code promo ». Il doit être saisi avant la validation du compte : il ne peut pas être ajouté ensuite.",
      },
      {
        q: "Puis-je utiliser le code si j'ai déjà un compte 1win ?",
        a: "Non. L'offre est strictement réservée aux nouveaux inscrits. Créer un second compte pour en profiter entraîne la fermeture des deux comptes.",
      },
      {
        q: "Comment retirer le bonus 1win ?",
        a: "Le bonus doit d'abord être converti en solde réel en jouant des paris combinés d'au moins 5 sélections cotées à 1.40 minimum, dans les 30 jours. Une fois converti, le retrait s'effectue par Mobile Money, carte ou crypto.",
      },
      {
        q: "Quel est le dépôt minimum pour activer le bonus ?",
        a: "1 000 FCFA suffisent pour activer le premier palier du bonus, mais le pourcentage s'appliquant au montant déposé, un dépôt plus élevé maximise l'offre.",
      },
      {
        q: "1win est-il disponible au Cameroun et en Côte d'Ivoire ?",
        a: "Oui. 1win accepte les joueurs de la majorité des pays d'Afrique francophone, avec paiement en FCFA et prise en charge des principaux opérateurs Mobile Money locaux.",
      },
      {
        q: "Le code PREDAT fonctionne-t-il sur l'application mobile ?",
        a: "Oui. L'inscription depuis l'application Android ou iOS propose le même champ « Code promo », avec un bonus identique.",
      },
    ],
  },
];

export function getBookmaker(slug: string): Bookmaker | undefined {
  return BOOKMAKERS.find((b) => b.slug === slug);
}
