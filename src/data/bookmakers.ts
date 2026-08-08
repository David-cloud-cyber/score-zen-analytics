import { BONUS_TYPES } from "./bookmaker-template";
/**
 * Contenu statique des pages « Codes promo » partenaires.
 *
 * Pour ajouter un bookmaker : copier un objet, changer les valeurs.
 * La page hub, la page article et le sitemap se mettent à jour automatiquement.
 */

import { defineBookmaker } from "./bookmaker-template";
import { BETWINNER } from "./bookmakers/betwinner";
import type { Bookmaker, BonusType } from "./bookmaker-template";

export { BONUS_TYPES, defineBookmaker } from "./bookmaker-template";
export type { Bookmaker, BonusType, BonusRow, FaqItem, Section, SubSection } from "./bookmaker-template";

export const BOOKMAKERS: Bookmaker[] = [
  defineBookmaker({
    slug: "1win",
    name: "1win",
    code: "PREDAT",
    affiliateUrl: "https://lkfg.pro/a66a894d",
    logoUrl: "https://1win.com/favicon.ico",
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
    bonusTypes: ["Bonus de bienvenue", "Bonus sur dépôt", "Bonus multi/combiné", "Bonus casino"],
    updatedAt: "2026-08-05",
    seoTitle: "Code promo 1win PREDAT : 130 000 FCFA de bonus (août 2026)",
    seoDescription:
      "Code promo 1win PREDAT vérifié en août 2026 : jusqu'à 130 000 FCFA de bonus sur 4 dépôts. Inscription pas à pas, conditions, Mobile Money, exemples de paris et avis complet.",
    keyTakeaways: [
      "Code à saisir pendant l'inscription : PREDAT — impossible à ajouter après coup.",
      "Bonus maximal : 130 000 FCFA répartis sur les 4 premiers dépôts (+500 %).",
      "Dépôt minimum 1 000 FCFA, retraits Mobile Money en moins de 15 minutes en moyenne.",
      "Déblocage par paris combinés : 5 sélections minimum cotées 1.40 ou plus, sous 30 jours.",
      "Disponible au Cameroun, en Côte d'Ivoire, au Sénégal, au Mali, au Burkina, au Bénin, au Togo et en RDC.",
    ],
    intro: [
      "Le code promo 1win PREDAT débloque le bonus de bienvenue maximal du bookmaker : jusqu'à 130 000 FCFA répartis sur vos quatre premiers dépôts, soit +500 % de votre mise de départ. C'est, en août 2026, l'une des offres les plus généreuses accessibles depuis l'Afrique francophone.",
      "Ce code se saisit au moment de la création du compte, dans le champ prévu à cet effet. Il est valable pour tous les nouveaux inscrits majeurs, sur le site comme sur l'application Android et iOS. Il ne peut pas être ajouté après l'ouverture du compte : c'est le seul vrai point de vigilance.",
      "Chez LiveFoot AI, nous confrontons chaque jour nos analyses IA aux cotes 1win. Cette page détaille l'offre, les conditions de mise, les moyens de paiement Mobile Money, des exemples concrets de paris football et basket, et notre avis honnête — points faibles compris.",
      "Le parcours recommandé est rapide : cliquez sur l'inscription depuis LiveFoot, choisissez votre devise, saisissez PREDAT avant de valider, puis vérifiez que le bonus apparaît dans votre compte. Cette étape de contrôle est importante, car un code oublié après le premier dépôt est rarement récupérable.",
      "L'objectif n'est pas de vous pousser à déposer davantage, mais de vous aider à comparer une offre avec ses conditions réelles. Utilisez PREDAT seulement si le délai de 30 jours, les paris combinés et les règles de retrait correspondent à votre façon de jouer et à votre budget.",
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
      { label: "Conditions de mise", value: "Paris combinés, 5 sélections cotées 1.40 minimum" },
      { label: "Délai d'utilisation", value: "30 jours après le crédit du bonus" },
      { label: "Sports éligibles", value: "Tous, football et basket inclus" },
      { label: "Application mobile", value: "Android (APK) et iOS" },
      { label: "Devise", value: "FCFA (XOF / XAF)" },
      { label: "Vérifié le", value: "5 août 2026" },
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
        id: "meilleur-code",
        title: "Quel est le meilleur code promo 1win en août 2026 ?",
        paragraphs: [
          "En août 2026, le meilleur code promo 1win est PREDAT. Il n'existe pas de code « secret » plus avantageux : le bookmaker plafonne son offre de bienvenue à 130 000 FCFA, et PREDAT vous place directement à ce plafond. Tout code promettant davantage est soit périmé, soit inventé.",
          "La bonne question n'est donc pas « quel code rapporte le plus », mais « comment transformer ce bonus en solde réellement retirable ». C'est tout l'objet de cette page.",
        ],
        sub: [
          {
            id: "presentation-code",
            title: "Présentation du code promo 1win PREDAT",
            paragraphs: [
              "PREDAT est un code partenaire officiel négocié pour les utilisateurs de LiveFoot AI. Il est gratuit, ne modifie aucune cote et n'ajoute aucune obligation : il porte simplement votre bonus de bienvenue au maximum autorisé.",
              "Concrètement, sans code vous touchez l'offre standard, limitée au premier dépôt. Avec PREDAT, le pourcentage s'applique à vos quatre premiers dépôts — un écart qui se compte en dizaines de milliers de FCFA pour un joueur régulier.",
            ],
            bullets: [
              "Code : PREDAT — validité permanente, vérifiée le 5 août 2026",
              "Type d'offre : bonus de dépôt cumulatif jusqu'à +500 %",
              "Public : nouveaux inscrits majeurs uniquement",
            ],
          },
          {
            id: "pourquoi-code",
            title: "Pourquoi utiliser un code promo lors de l'inscription ?",
            paragraphs: [
              "Un code promo ne change pas les règles du jeu : il change votre point de départ. Avec 10 000 FCFA déposés sans code, vous jouez avec 10 000 FCFA. Avec PREDAT, vous démarrez à 30 000 FCFA de capital jouable au premier palier.",
              "Ce capital supplémentaire sert surtout à absorber la variance des premières semaines, période où la plupart des joueurs se brûlent en misant trop gros trop vite. C'est un coussin, pas un cadeau à dépenser immédiatement.",
            ],
          },
          {
            id: "avantages-afrique",
            title: "Avantages du code promo pour les nouveaux joueurs africains",
            paragraphs: [
              "L'offre a été calibrée pour le marché africain francophone : montants exprimés en FCFA, dépôt minimum très bas, et surtout dépôts et retraits par Mobile Money sans intermédiaire.",
            ],
            bullets: [
              "Ticket d'entrée à 1 000 FCFA seulement pour activer le premier palier",
              "Orange Money, MTN MoMo, Moov Money et Wave pris en charge nativement",
              "Interface, support et paris disponibles en français 24h/24",
              "Championnats africains couverts (Ligue 1 camerounaise, Ligue 1 ivoirienne, CAN, CHAN)",
            ],
          },
          {
            id: "conditions-avant",
            title: "Conditions générales à connaître avant l'activation",
            paragraphs: [
              "Trois règles conditionnent tout le reste : le code se saisit pendant l'inscription, le bonus se débloque en combinés, et le délai est de 30 jours. Un joueur qui ignore l'une des trois perd mécaniquement son bonus.",
            ],
            bullets: [
              "Un seul compte par personne, foyer et adresse IP",
              "Cote minimale 1.40 par sélection, 5 sélections minimum par combiné",
              "Paris cash-out, annulés ou remboursés exclus du déblocage",
              "KYC (pièce d'identité) exigé avant les retraits importants",
            ],
          },
        ],
      },
      {
        id: "bonus-avantages",
        title: "Code promo 1win PREDAT : quels bonus et avantages sont disponibles ?",
        paragraphs: [
          "L'offre PREDAT ne se résume pas au bonus d'inscription. Une fois le compte ouvert, vous accédez au même programme promotionnel que les joueurs historiques, avec des offres qui tournent toute l'année.",
        ],
        sub: [
          {
            id: "bonus-bienvenue",
            title: "Bonus de bienvenue 1win",
            paragraphs: [
              "Le bonus de bienvenue atteint 130 000 FCFA au total. Il est crédité sur un solde bonus séparé, visible en permanence dans votre compte, et se convertit en argent réel au fil de vos combinés qualifiants.",
            ],
          },
          {
            id: "premiers-depots",
            title: "Bonus sur les premiers dépôts",
            paragraphs: [
              "Le pourcentage décroît à chaque palier : mieux vaut donc répartir intelligemment ses dépôts plutôt que tout verser d'un coup sur le premier.",
            ],
            bullets: [
              "1er dépôt : +200 % du montant déposé",
              "2e dépôt : +150 %",
              "3e dépôt : +100 %",
              "4e dépôt : +50 %",
              "Plafond cumulé : 130 000 FCFA",
            ],
          },
          {
            id: "promos-aout",
            title: "Promotions temporaires disponibles en août 2026",
            paragraphs: [
              "Août 2026 correspond à la reprise des grands championnats européens et à la préparation de la saison NBA. 1win aligne ses offres sur ce calendrier : boosts de cotes sur les journées d'ouverture, cashback renforcé et tournois de pronostics.",
            ],
          },
          {
            id: "offres-sports",
            title: "Offres spéciales football, NBA et paris sportifs",
            paragraphs: [
              "Les majorations Express Bonus s'appliquent en priorité au football et au basket, les deux disciplines les plus jouées sur le marché africain. Un combiné de 11 sélections peut voir ses gains majorés de plusieurs dizaines de pourcents.",
            ],
          },
          {
            id: "bonus-vs-cashback",
            title: "Différence entre bonus, cashback et promotions",
            paragraphs: [
              "Ces trois termes n'engagent pas du tout les mêmes contraintes, et les confondre coûte cher.",
            ],
            bullets: [
              "Bonus : crédit soumis à conditions de mise, non retirable tant qu'il n'est pas converti",
              "Cashback : remboursement d'une part de vos pertes nettes, souvent en argent réel ou faiblement conditionné",
              "Promotion : avantage ponctuel (cote boostée, assurance pari, freebet) lié à un événement précis",
            ],
          },
        ],
      },
      {
        id: "pays-afrique",
        title: "Dans quels pays d'Afrique le code promo 1win 2026 est-il disponible ?",
        paragraphs: [
          "Le code PREDAT est actif dans la grande majorité des pays d'Afrique subsaharienne francophone, avec affichage automatique en FCFA dès que vous sélectionnez votre pays à l'inscription.",
        ],
        sub: [
          {
            id: "regions",
            title: "Disponibilité selon les régions africaines",
            paragraphs: [
              "Afrique de l'Ouest (zone XOF) et Afrique centrale (zone XAF) sont pleinement couvertes. L'Afrique du Nord et certains marchés anglophones disposent de devises et d'offres distinctes, avec un plafond de bonus parfois différent.",
            ],
          },
          {
            id: "pays-francophones",
            title: "Pays francophones concernés",
            paragraphs: [
              "La liste ci-dessous correspond aux marchés où le code a été testé et confirmé fonctionnel en août 2026.",
            ],
            bullets: [
              "Cameroun (XAF) — Orange Money, MTN MoMo",
              "Côte d'Ivoire (XOF) — Orange, MTN, Moov, Wave",
              "Sénégal (XOF) — Orange Money, Wave, Free Money",
              "Mali, Burkina Faso, Bénin, Togo, Niger (XOF)",
              "RDC, Gabon, Congo, Tchad (XAF / CDF)",
            ],
          },
          {
            id: "utilisation-pays",
            title: "Utilisation depuis le Cameroun, la Côte d'Ivoire, le Sénégal, le Mali ou la RDC",
            paragraphs: [
              "La procédure est identique partout : pays, devise, code PREDAT, dépôt Mobile Money. Seule la liste des opérateurs de paiement change selon votre pays, elle s'adapte automatiquement à votre sélection.",
            ],
          },
          {
            id: "restrictions",
            title: "Restrictions éventuelles selon le pays",
            paragraphs: [
              "Quelques juridictions restreignent l'accès aux opérateurs sans licence locale. Si la page d'inscription refuse votre pays, aucun contournement n'est recommandé : un compte ouvert depuis un pays exclu est bloqué au moment du retrait, après vérification d'identité.",
            ],
          },
        ],
      },
      {
        id: "inscription-details",
        title: "Réussir son inscription avec le code promo PREDAT",
        paragraphs: [
          "Les six étapes ci-dessus suffisent dans 95 % des cas. Les points suivants traitent les 5 % restants, c'est-à-dire les situations où le bonus n'apparaît pas.",
        ],
        sub: [
          {
            id: "ou-code",
            title: "Où renseigner le code promo ?",
            paragraphs: [
              "Le champ « Code promo » se trouve en bas du formulaire d'inscription, parfois replié derrière un lien « J'ai un code promo ». Sur l'application mobile, il apparaît après le choix de la devise.",
            ],
          },
          {
            id: "verification-activation",
            title: "Vérifier que le bonus est bien activé",
            paragraphs: [
              "Après votre premier dépôt, ouvrez la section « Bonus » de votre compte : le montant crédité et la barre de progression du wager doivent apparaître. Si la section est vide, le code n'a pas été pris en compte — contactez le support avant de miser.",
            ],
          },
          {
            id: "erreurs-inscription",
            title: "Erreurs fréquentes lors de l'inscription",
            paragraphs: ["Ces quatre erreurs représentent la quasi-totalité des bonus perdus."],
            bullets: [
              "Valider le formulaire sans avoir saisi PREDAT",
              "Choisir une devise autre que le FCFA puis vouloir la changer ensuite (impossible)",
              "Saisir un nom différent de celui de la pièce d'identité, ce qui bloque le KYC",
              "Créer un second compte pour « réessayer » : les deux comptes sont fermés",
            ],
          },
          {
            id: "conseils-bonus",
            title: "Conseils pour éviter la perte du bonus",
            paragraphs: [
              "Notez la date de crédit du bonus : les 30 jours courent à partir de là. Planifiez vos combinés qualifiants dès la première semaine plutôt que de courir après le délai en fin de période, moment où l'on prend les pires décisions.",
            ],
          },
        ],
        cta: {
          title: "Sécurisez vos premiers combinés",
          text: "Avant de placer les combinés qui débloquent votre bonus, passez chaque affiche au moteur de prédictions IA de LiveFoot : probabilités, forme des équipes et valeur des cotes en quelques secondes.",
          label: "Lancer une analyse IA",
        },
      },
      {
        id: "paiements",
        title: "Dépôt et retrait avec le code promo 1win : méthodes disponibles en Afrique",
        paragraphs: [
          "C'est le point fort de 1win en Afrique francophone : le Mobile Money est intégré nativement, sans intermédiaire. Les dépôts sont instantanés et les retraits sont traités en moins de 15 minutes en moyenne en heures ouvrées.",
        ],
        sub: [
          {
            id: "methodes-paiement",
            title: "Méthodes de paiement populaires en Afrique",
            paragraphs: [
              "Aucune commission n'est prélevée par le bookmaker sur les dépôts ; les frais éventuels proviennent uniquement de votre opérateur Mobile Money.",
            ],
            bullets: [
              "Orange Money, MTN Mobile Money, Moov Money, Wave",
              "Cartes Visa et Mastercard",
              "Cryptomonnaies : Bitcoin, USDT (TRC-20), Ethereum",
            ],
          },
          {
            id: "depot-minimum",
            title: "Dépôt minimum et conditions associées",
            paragraphs: [
              "Le dépôt minimum est de 1 000 FCFA et le retrait minimum de 2 000 FCFA. Le pourcentage de bonus s'appliquant au montant versé, un premier dépôt trop faible réduit mécaniquement l'intérêt de l'offre.",
            ],
          },
          {
            id: "delais-retraits",
            title: "Délais de traitement des retraits",
            paragraphs: [
              "Mobile Money : de quelques minutes à 1 heure. Carte bancaire : 1 à 3 jours ouvrés. Crypto : moins de 30 minutes. Un premier retrait déclenche presque toujours une vérification KYC, à anticiper.",
            ],
          },
          {
            id: "securiser-compte",
            title: "Conseils pour sécuriser son compte",
            paragraphs: [
              "Utilisez un mot de passe unique, activez la double authentification et vérifiez votre identité avant d'avoir besoin de retirer en urgence. Un compte vérifié à froid évite l'attente au pire moment.",
            ],
          },
          {
            id: "problemes-paiement",
            title: "Problèmes fréquents liés aux paiements",
            paragraphs: [
              "Un retrait bloqué provient presque toujours de l'une de ces trois causes : KYC incomplet, conditions de mise non remplies, ou nom du compte Mobile Money différent du titulaire du compte 1win.",
            ],
          },
        ],
      },
      {
        id: "promotions",
        title: "Promotions 1win après l'utilisation du code promo PREDAT",
        paragraphs: [
          "Une fois le bonus de bienvenue converti, l'intérêt de la plateforme sur la durée repose sur ses offres récurrentes.",
        ],
        sub: [
          {
            id: "bonus-permanents",
            title: "Bonus permanents et offres limitées",
            paragraphs: ["Ces offres restent accessibles indéfiniment, sans code supplémentaire."],
            bullets: [
              "Cashback hebdomadaire sur les pertes nettes, crédité chaque lundi",
              "Express Bonus : majoration progressive des gains sur les combinés de 5 sélections et plus",
              "Assurance pari : sécurisez tout ou partie d'une mise contre une fraction du montant",
            ],
          },
          {
            id: "promos-football",
            title: "Promotions football et grands événements sportifs",
            paragraphs: [
              "Ligue des champions, CAN, Premier League et Ligue 1 déclenchent des cotes boostées et des tournois de pronostics à cagnotte partagée, généralement annoncés le jour même dans l'onglet « Promotions ».",
            ],
          },
          {
            id: "paris-direct",
            title: "Paris en direct et fonctionnalités disponibles",
            paragraphs: [
              "Le live propose statistiques en temps réel, cash-out partiel, multi-live et streaming sur une partie des rencontres. La latence est correcte, mais les cotes bougent vite : préparez vos scénarios avant le coup d'envoi.",
            ],
          },
          {
            id: "fidelite",
            title: "Programmes de fidélité et avantages joueurs",
            paragraphs: [
              "Un système de paliers récompense le volume de jeu par des freebets et un cashback amélioré. Utile si vous jouez régulièrement, sans intérêt si vous pariez ponctuellement.",
            ],
          },
        ],
      },
      {
        id: "optimiser-gains",
        title: "Comment optimiser ses gains avec le code promo 1win ?",
        paragraphs: [
          "Un bonus n'est pas un gain : c'est un capital à faire tourner sans se ruiner. La différence entre un joueur qui convertit son bonus et un joueur qui le perd tient rarement à la chance, presque toujours à la méthode.",
        ],
        sub: [
          {
            id: "strategies-bonus",
            title: "Stratégies pour utiliser intelligemment un bonus",
            paragraphs: [
              "Construisez des combinés de 5 sélections proches du minimum de cote (1.40 à 1.60) plutôt que des tickets à très forte cote : la probabilité de valider le wager augmente nettement, même si le gain unitaire est plus faible.",
            ],
          },
          {
            id: "bankroll",
            title: "Gestion du budget et de la bankroll",
            paragraphs: [
              "Règle simple et éprouvée : jamais plus de 2 à 5 % de votre bankroll sur un même ticket. Avec 20 000 FCFA de capital, cela signifie des mises de 400 à 1 000 FCFA — ennuyeux, mais c'est exactement ce qui vous maintient en jeu assez longtemps pour convertir le bonus.",
            ],
          },
          {
            id: "erreurs-promotions",
            title: "Erreurs à éviter avec les promotions",
            paragraphs: [
              "Ne courez pas après une promotion qui vous pousse à parier sur un sport que vous ne suivez pas, ni à augmenter vos mises pour atteindre un palier. Une offre ne crée de la valeur que si elle s'applique à des paris que vous auriez faits de toute façon.",
            ],
          },
          {
            id: "jouer-mieux",
            title: "Jouer plus ou mieux gérer ses paris ?",
            paragraphs: [
              "Multiplier les tickets multiplie surtout la marge du bookmaker. Réduire le volume et documenter chaque pari — probabilité estimée, cote obtenue, raison de la sélection — est la seule approche qui progresse dans le temps.",
            ],
          },
        ],
        cta: {
          title: "Comparez la cote 1win à la probabilité réelle",
          text: "Notre moteur IA estime les probabilités d'un match à partir de la forme, des confrontations directes, des blessures et des statistiques avancées. Si la cote dépasse la probabilité estimée, il y a de la valeur.",
          label: "Comparer deux équipes",
        },
      },
      {
        id: "ticket-wnba",
        title: "Notre conseil : exemple de ticket combiné WNBA avec le code promo 1win",
        paragraphs: [
          "En août, la WNBA est l'une des rares compétitions majeures en pleine activité — utile pour valider un wager pendant l'intersaison européenne. Voici comment nous construisons un ticket, à titre strictement pédagogique.",
        ],
        sub: [
          {
            id: "exemple-basket",
            title: "Analyse d'un exemple de pari basket",
            paragraphs: [
              "Plutôt que de miser sur le vainqueur d'un match serré, nous privilégions des marchés à forte probabilité : handicap large en faveur d'une équipe dominante à domicile, ou total de points ajusté au rythme de jeu des deux formations.",
            ],
            bullets: [
              "Sélection 1 : handicap -8,5 pour l'équipe la mieux classée à domicile (≈ 1.45)",
              "Sélection 2 : total de points supérieur à 155,5 sur une affiche à rythme élevé (≈ 1.50)",
              "Sélection 3 : équipe leader vainqueur d'un quart-temps au moins (≈ 1.40)",
              "Sélections 4 et 5 : mêmes logiques sur deux autres rencontres du programme",
            ],
          },
          {
            id: "cotes-combinees",
            title: "Comprendre les cotes combinées",
            paragraphs: [
              "Les cotes se multiplient : cinq sélections à 1.45 donnent environ 6.41. Mais les probabilités se multiplient aussi. Cinq événements à 65 % de chances donnent seulement 11,6 % de réussite globale. C'est le cœur du malentendu sur les combinés.",
            ],
          },
          {
            id: "risques-multiples",
            title: "Avantages et risques des tickets multiples",
            paragraphs: [
              "Le combiné est obligatoire pour débloquer le bonus et permet une majoration Express, mais une seule erreur annule tout le ticket. À réserver au wager et aux mises réduites, jamais à l'essentiel de votre bankroll.",
            ],
          },
          {
            id: "analyser-rencontre",
            title: "Comment analyser une rencontre avant de miser",
            paragraphs: [
              "Regardez la forme sur cinq matchs, le rythme (possessions par match au basket, xG au football), les absences et le calendrier — une équipe qui enchaîne trois déplacements en cinq jours ne vaut pas sa cote nominale.",
            ],
          },
        ],
        cta: {
          title: "Faites analyser votre ticket par l'IA",
          text: "Entrez les équipes de votre combiné dans le moteur de prédictions LiveFoot : vous obtenez les probabilités de victoire, la forme récente et les marchés les plus cohérents avant de valider votre mise.",
          label: "Analyser mon match",
        },
      },
      {
        id: "basket-nba",
        title: "Parier sur le basket avec le code promo 1win PREDAT : exemple concret NBA",
        paragraphs: [
          "La NBA est la deuxième discipline la plus jouée sur 1win en Afrique, avec une profondeur de marchés comparable au football et des cotes très compétitives sur les paris joueurs.",
        ],
        sub: [
          {
            id: "marches-nba",
            title: "Marchés disponibles sur la NBA",
            paragraphs: ["L'offre couvre le match, les périodes et les performances individuelles."],
            bullets: [
              "Vainqueur, handicap (spread), total de points (over/under)",
              "Résultat par quart-temps et par mi-temps",
              "Statistiques joueur : points, rebonds, passes, tirs à 3 points",
              "Combinés joueur (points + rebonds + passes)",
            ],
          },
          {
            id: "simples-combines",
            title: "Paris simples ou paris combinés ?",
            paragraphs: [
              "Le pari simple garde l'avantage sur le long terme : une seule variable, un seul risque. Le combiné se justifie pour le wager du bonus ou pour un ticket plaisir à faible mise, jamais comme stratégie principale.",
            ],
          },
          {
            id: "stats-nba",
            title: "Statistiques importantes à analyser",
            paragraphs: [
              "Le rating offensif et défensif pour 100 possessions, le pace, les back-to-back, la profondeur du banc et les blessures annoncées une heure avant le tip-off — cette dernière information déplace les lignes plus que toute autre.",
            ],
          },
          {
            id: "construire-pari",
            title: "Exemple d'approche pour construire un pari",
            paragraphs: [
              "Identifiez d'abord une inefficacité (une équipe sous-cotée après deux défaites trompeuses), vérifiez ensuite l'absence de facteur bloquant (blessure, repos, déplacement), puis choisissez le marché qui exprime le mieux votre lecture — souvent le handicap plutôt que le vainqueur sec.",
            ],
          },
        ],
      },
      {
        id: "football",
        title: "Parier sur le football avec le code promo 1win",
        paragraphs: [
          "Le football reste la discipline reine : c'est là que 1win propose le plus de marchés, les meilleures marges et l'essentiel de ses promotions.",
        ],
        sub: [
          {
            id: "championnats",
            title: "Championnats populaires en Afrique et en Europe",
            paragraphs: [
              "Premier League, Ligue 1, Liga, Serie A, Bundesliga et Ligue des champions sont couvertes intégralement, aux côtés de la CAN, du CHAN et des championnats nationaux camerounais, ivoirien et sénégalais.",
            ],
          },
          {
            id: "avant-match-live",
            title: "Paris avant-match et en direct",
            paragraphs: [
              "L'avant-match laisse le temps d'analyser ; le live récompense la lecture du jeu. Une équipe dominante menée à la mi-temps offre régulièrement une cote très supérieure à sa probabilité réelle de renversement.",
            ],
          },
          {
            id: "cotes-probabilites",
            title: "Comprendre les cotes et les probabilités",
            paragraphs: [
              "Probabilité implicite = 1 ÷ cote. Une cote de 2.50 correspond à 40 %. Si votre estimation est de 48 %, le pari a de la valeur ; si elle est de 33 %, il n'en a aucune, même si l'équipe gagne ce soir-là.",
            ],
          },
          {
            id: "ameliorer-analyses",
            title: "Conseils pour améliorer ses analyses",
            paragraphs: [
              "Appuyez-vous sur des données plutôt que sur des impressions : xG sur les cinq derniers matchs, performance domicile/extérieur, blessures, enjeu du match. C'est exactement ce que le moteur de prédictions IA de LiveFoot agrège automatiquement pour vous.",
            ],
          },
        ],
        cta: {
          title: "Analysez votre prochaine affiche en 10 secondes",
          text: "Sélectionnez deux équipes et obtenez probabilités de victoire, forme récente, confrontations directes et marchés recommandés — puis placez votre pari sur 1win avec le code PREDAT.",
          label: "Ouvrir le moteur de prédictions IA",
        },
      },
      {
        id: "comparatif",
        title: "Comparatif du code promo 1win face aux autres bookmakers en Afrique",
        paragraphs: [
          "Le bonus 1win est le plus élevé du marché en valeur faciale. Reste à le comparer sur les critères qui comptent réellement au quotidien.",
        ],
        sub: [
          {
            id: "comparatif-bonus",
            title: "Bonus de bienvenue",
            paragraphs: [
              "130 000 FCFA sur quatre dépôts placent 1win devant la plupart des opérateurs présents en Afrique francophone, dont les offres tournent généralement autour de 50 000 à 100 000 FCFA sur un seul dépôt.",
            ],
          },
          {
            id: "comparatif-sports",
            title: "Variété des sports disponibles",
            paragraphs: [
              "Plus de 30 disciplines, e-sport et sports virtuels inclus. La profondeur des marchés football en direct est au niveau des meilleurs opérateurs internationaux.",
            ],
          },
          {
            id: "comparatif-paiement",
            title: "Moyens de paiement",
            paragraphs: [
              "L'intégration Mobile Money directe, sans agrégateur tiers, est un avantage net : moins d'échecs de transaction et des retraits plus rapides que la moyenne du secteur.",
            ],
          },
          {
            id: "comparatif-mobile",
            title: "Expérience utilisateur mobile",
            paragraphs: [
              "L'application est fluide et économe en données, ce qui compte sur des réseaux instables. Seul bémol : l'installation manuelle de l'APK sur Android.",
            ],
          },
          {
            id: "comparatif-support",
            title: "Service client et fiabilité",
            paragraphs: [
              "Chat 24h/24 en français avec réponse en quelques minutes, e-mail plus lent, canal Telegram actif. Les litiges portent presque toujours sur des KYC incomplets plutôt que sur des refus de paiement.",
            ],
          },
        ],
      },
      {
        id: "securite",
        title: "Sécurité, vérification et protection du compte 1win",
        paragraphs: [
          "1win opère sous licence Curaçao, avec chiffrement SSL des connexions et vérification d'identité avant les retraits significatifs — une pratique standard, signe de sérieux plutôt qu'obstacle.",
        ],
        sub: [
          {
            id: "double-auth",
            title: "Activation de la double authentification",
            paragraphs: [
              "Dans « Paramètres du compte », activez la vérification en deux étapes par SMS ou e-mail. C'est la protection la plus efficace contre le détournement de compte, particulièrement si vous utilisez un cybercafé ou un téléphone partagé.",
            ],
          },
          {
            id: "acces-non-autorises",
            title: "Protection contre les accès non autorisés",
            paragraphs: [
              "Consultez régulièrement l'historique de connexion, déconnectez les sessions inconnues et ne restez jamais connecté sur un appareil qui ne vous appartient pas.",
            ],
          },
          {
            id: "bonnes-pratiques",
            title: "Bonnes pratiques pour sécuriser ses données",
            paragraphs: ["Quatre réflexes suffisent à éliminer la quasi-totalité des risques."],
            bullets: [
              "Mot de passe unique, jamais réutilisé ailleurs",
              "Aucun partage de vos identifiants, même avec un « pronostiqueur »",
              "Méfiance envers les liens reçus par WhatsApp ou Telegram : passez toujours par le site officiel",
              "Compte Mobile Money au même nom que le compte de jeu",
            ],
          },
          {
            id: "probleme-connexion",
            title: "Que faire en cas de problème de connexion ?",
            paragraphs: [
              "Videz le cache, essayez le miroir officiel indiqué par le support, ou passez par l'application. Si le blocage persiste, contactez le chat en précisant votre identifiant de compte, jamais votre mot de passe.",
            ],
          },
        ],
      },
      {
        id: "code-ne-marche-pas",
        title: "Que faire si mon code promo 1win PREDAT ne fonctionne pas ?",
        paragraphs: [
          "Dans la majorité des cas, le problème vient du moment de la saisie et non du code lui-même. Voici le diagnostic à dérouler dans l'ordre.",
        ],
        sub: [
          {
            id: "verifier-validite",
            title: "Vérifier la validité du code",
            paragraphs: [
              "Saisissez PREDAT en majuscules, sans espace avant ni après. Le champ doit afficher une confirmation visuelle avant la validation du formulaire.",
            ],
          },
          {
            id: "probleme-pays",
            title: "Problèmes liés au pays ou au compte",
            paragraphs: [
              "Un pays non couvert, une devise autre que le FCFA ou un compte déjà existant à votre nom bloquent l'application du code. Un VPN peut également faire échouer la validation.",
            ],
          },
          {
            id: "conditions-non-respectees",
            title: "Conditions non respectées",
            paragraphs: [
              "Bonus crédité mais non converti ? Vérifiez la cote minimale (1.40), le nombre de sélections (5) et le délai de 30 jours. Les paris cash-out ne comptent pas dans la progression.",
            ],
          },
          {
            id: "solutions",
            title: "Solutions possibles",
            paragraphs: [
              "Si le code n'a pas été saisi, ne créez surtout pas un second compte : demandez au support d'appliquer PREDAT avant votre premier dépôt. La demande aboutit parfois lorsqu'aucune transaction n'a encore eu lieu.",
            ],
          },
          {
            id: "contacter-support",
            title: "Contacter le support",
            paragraphs: [
              "Chat en direct (le plus rapide), e-mail ou Telegram. Fournissez votre identifiant, la date d'inscription et une capture du formulaire : le dossier est traité plus vite.",
            ],
          },
        ],
      },
      {
        id: "erreurs-frequentes",
        title: "Les erreurs fréquentes à éviter avec les codes promo 1win",
        paragraphs: [
          "Ces quatre erreurs expliquent l'immense majorité des bonus perdus, et aucune n'a de rapport avec la chance.",
        ],
        sub: [
          {
            id: "multi-comptes",
            title: "Créer plusieurs comptes",
            paragraphs: [
              "C'est la faute la plus lourdement sanctionnée : fermeture des comptes et confiscation des gains, sans recours. Un seul compte par personne, par foyer et par adresse IP.",
            ],
          },
          {
            id: "ignorer-conditions",
            title: "Ne pas lire les conditions du bonus",
            paragraphs: [
              "Un bonus de 130 000 FCFA dont on ignore les règles de conversion vaut exactement zéro. Les cinq minutes de lecture sont le meilleur investissement de votre inscription.",
            ],
          },
          {
            id: "miser-sans-strategie",
            title: "Miser sans stratégie",
            paragraphs: [
              "Placer un bonus entier sur un seul combiné à cote 30 revient à jouer à la loterie. Le déblocage se joue sur le volume maîtrisé, pas sur un coup d'éclat.",
            ],
          },
          {
            id: "limites-bonus",
            title: "Ignorer les limites du bonus",
            paragraphs: [
              "Mise maximale autorisée, marchés exclus, délai de 30 jours : dépasser une seule de ces limites peut annuler la totalité du bonus, y compris la partie déjà convertie.",
            ],
          },
        ],
      },
      {
        id: "verdict",
        title: "Verdict final sur le code promo 1win PREDAT en Afrique",
        paragraphs: [
          "Note LiveFoot AI : 4,6 / 5. 1win combine le bonus le plus élevé du marché et une intégration Mobile Money réellement fonctionnelle, ce qui reste rare sur ce segment.",
        ],
        sub: [
          {
            id: "analyse-globale",
            title: "Notre analyse globale",
            paragraphs: [
              "L'offre PREDAT est objectivement supérieure à la moyenne du marché africain francophone, à condition d'accepter un déblocage par combinés. La couverture football est complète, du championnat camerounais à la Ligue des champions, avec un volume de marchés en direct de haut niveau.",
            ],
          },
          {
            id: "profil-joueur",
            title: "Pour quel type de joueur ce code est-il intéressant ?",
            paragraphs: [
              "Idéal pour le parieur régulier qui joue déjà des combinés football ou basket et qui utilise le Mobile Money. Nettement moins pertinent pour un joueur prudent adepte des paris simples à faible cote, pour qui le wager sera long à valider.",
            ],
          },
          {
            id: "forts-limites",
            title: "Les points forts et les limites",
            paragraphs: [
              "Points forts : montant du bonus, rapidité des retraits, largeur de l'offre sportive, support francophone 24h/24. Limites : conditions de mise exigeantes, APK Android à installer manuellement, licence Curaçao moins protectrice qu'une licence européenne.",
            ],
          },
          {
            id: "recommandation",
            title: "Recommandation finale",
            paragraphs: [
              "Inscrivez-vous avec PREDAT, déposez un montant que vous pouvez réellement immobiliser 30 jours, et convertissez le bonus avec des combinés de cinq sélections à cote modérée. Adossez chaque sélection à une analyse chiffrée plutôt qu'à une intuition : c'est là que se joue la différence.",
            ],
          },
        ],
        cta: {
          title: "Passez de l'intuition à la donnée",
          text: "L'IA LiveFoot analyse gratuitement vos affiches : probabilités, forme, blessures et marchés recommandés. Utilisez-la avant chaque combiné pour ne pas jouer à l'aveugle.",
          label: "Analyser un match maintenant",
        },
      },
    ],
    pros: [
      "Bonus de bienvenue jusqu'à 130 000 FCFA, parmi les plus élevés du marché",
      "Mobile Money intégré : Orange, MTN, Moov, Wave",
      "Retraits rapides, souvent sous 15 minutes",
      "Large couverture football, y compris championnats africains",
      "Plus de 30 sports, dont NBA et WNBA avec paris joueurs",
      "Support 24h/24 en français",
    ],
    cons: [
      "Conditions de mise exigeantes (combinés de 5 sélections, cote 1.40 minimum)",
      "Application Android à installer manuellement en APK",
      "Licence Curaçao, moins protectrice qu'une licence européenne",
      "Code impossible à appliquer après la création du compte",
    ],
    faq: [
      {
        q: "Quel est le code promo 1win actuel ?",
        a: "Le code promo 1win actuel est PREDAT, vérifié le 5 août 2026. Il donne accès au bonus de bienvenue maximal, soit jusqu'à 130 000 FCFA répartis sur les quatre premiers dépôts.",
      },
      {
        q: "Comment obtenir le bonus d'inscription ?",
        a: "Créez un compte sur 1win, choisissez la devise FCFA, saisissez PREDAT dans le champ « Code promo » avant de valider, puis effectuez un dépôt d'au moins 1 000 FCFA. Le bonus est crédité instantanément sur votre solde bonus.",
      },
      {
        q: "Le code promo fonctionne-t-il au Cameroun ?",
        a: "Oui. Le code PREDAT est actif au Cameroun avec paiement en FCFA (XAF) via Orange Money et MTN Mobile Money, comme en Côte d'Ivoire, au Sénégal, au Mali, au Burkina, au Bénin, au Togo et en RDC.",
      },
      {
        q: "Peut-on utiliser 1win sur mobile ?",
        a: "Oui. Le site est optimisé mobile et une application existe en APK pour Android (téléchargeable sur le site officiel, l'app n'étant pas sur le Play Store) et sur l'App Store pour iOS. Le code PREDAT fonctionne à l'identique lors d'une inscription depuis l'application.",
      },
      {
        q: "Comment retirer ses gains ?",
        a: "Rendez-vous dans « Caisse » puis « Retrait », choisissez Mobile Money, carte ou crypto, et saisissez le montant (minimum 2 000 FCFA). Le compte doit être vérifié (KYC) et le bonus entièrement converti pour que la somme soit retirable.",
      },
      {
        q: "Le bonus expire-t-il ?",
        a: "Oui. Vous disposez de 30 jours à compter du crédit du bonus pour remplir les conditions de mise. Passé ce délai, la partie non convertie du bonus est supprimée.",
      },
      {
        q: "Peut-on modifier son code promo après inscription ?",
        a: "Non. Le code doit être saisi pendant la création du compte. S'il a été oublié, contactez le support avant tout dépôt : la demande aboutit parfois si aucune transaction n'a encore eu lieu. Ne créez jamais un second compte, cela entraîne la fermeture des deux.",
      },
      {
        q: "Le code promo 1win est-il gratuit ?",
        a: "Oui, totalement. PREDAT est gratuit et n'engendre aucun frais. LiveFoot AI perçoit une commission d'affiliation de la part du bookmaker, sans aucun impact sur vos cotes ni sur votre bonus.",
      },
    ],
  }),
  BETWINNER,
];

export function getBookmaker(slug: string): Bookmaker | undefined {
  return BOOKMAKERS.find((b) => b.slug === slug);
}

/** Maillage interne : alternatives proposées sur une page bookmaker. */
export function getRelatedBookmakers(slug: string, limit = 3): Bookmaker[] {
  const current = getBookmaker(slug);
  return BOOKMAKERS.filter((b) => b.slug !== slug)
    .sort((a, b) => {
      const shared = (x: Bookmaker) =>
        current ? x.bonusTypes.filter((t) => current.bonusTypes.includes(t)).length : 0;
      return shared(b) - shared(a) || b.rating - a.rating;
    })
    .slice(0, limit);
}

/** Types de bonus réellement présents dans le catalogue (pour les filtres). */
export function availableBonusTypes(): BonusType[] {
  return (BONUS_TYPES as readonly BonusType[]).filter((t) => BOOKMAKERS.some((b) => b.bonusTypes.includes(t)));
}
