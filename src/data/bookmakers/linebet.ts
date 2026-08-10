import { defineBookmaker } from "../bookmaker-template";

const LINEBET_AFFILIATE_URL = "https://lb-aff.com/L?tag=d_1972375m_22611c_&site=1972375&ad=22611";

/**
 * Fiche éditoriale Linebet. Les montants et conditions étant variables selon
 * la juridiction, ils sont volontairement présentés comme des éléments à
 * confirmer dans l'offre visible au moment de l'inscription.
 */
export const LINEBET = defineBookmaker({
  slug: "linebet",
  name: "Linebet",
  code: "PREDAT",
  affiliateUrl: LINEBET_AFFILIATE_URL,
  logoUrl: "/bookmakers/linebet.svg",
  accent: "#e43b32",
  tagline: "Code partenaire PREDAT et offre de bienvenue à vérifier selon votre pays",
  bonusHeadline: "Offre de bienvenue à vérifier selon la campagne active",
  bonusShort: "Saisissez PREDAT pendant l'inscription et contrôlez le montant affiché",
  minDeposit: "À vérifier dans le formulaire Linebet de votre pays",
  licence: "À vérifier dans les mentions légales et les conditions locales",
  bonusTypes: ["Bonus de bienvenue", "Bonus sur dépôt", "Bonus multi/combiné"],
  updatedAt: "2026-08-09",
  seoTitle: "Code promo Linebet PREDAT : inscription, bonus et conditions",
  seoDescription:
    "Code promo Linebet PREDAT : guide complet pour l'inscription, la vérification de l'offre, les paiements en Afrique francophone, les retraits et les conditions de mise.",
  directAnswer:
    "Le code partenaire Linebet à saisir pendant l'inscription est PREDAT. Le montant de l'offre de bienvenue, le dépôt minimum et les conditions de mise peuvent changer selon le pays et la campagne active. Ouvrez le lien partenaire, contrôlez l'offre affichée dans votre compte, puis ne déposez qu'après avoir lu ses règles.",
  keyTakeaways: [
    "Code partenaire à saisir pendant l'inscription : PREDAT.",
    "Le montant du bonus est variable : seule l'offre affichée dans votre compte fait foi.",
    "Le pays, la devise et les moyens de paiement peuvent modifier l'offre disponible.",
    "Vérifiez le dépôt minimum, le délai, les cotes éligibles et le multiplicateur avant de jouer.",
    "Les gains ne sont jamais garantis : la page est informative et réservée aux personnes majeures.",
  ],
  intro: [
    "Le code promo Linebet PREDAT est le code partenaire que LiveFoot recommande pour ouvrir le parcours d'inscription Linebet. Il doit être saisi au bon moment, avant la validation définitive du compte, afin que la campagne associée puisse être reconnue. Le code ne constitue pas une promesse de gain et ne remplace jamais les conditions affichées par l'opérateur.",
    "L'information la plus importante à retenir est la variabilité de l'offre. Un bookmaker peut afficher des montants, des devises, des dépôts minimums ou des règles différentes selon le pays, l'appareil, la date et la campagne active. Pour cette raison, nous n'inventons pas de montant fixe : la page vous aide à identifier et à vérifier les éléments qui s'appliquent réellement à votre compte.",
    "Le parcours conseillé est simple : ouvrez le lien Linebet présent sur cette page, créez un compte avec des informations exactes, renseignez PREDAT, puis relisez la fiche de promotion avant tout dépôt. Vérifiez aussi que l'offre est bien activée et qu'elle correspond à la rubrique sportive que vous souhaitez utiliser.",
    "Dans les pays d'Afrique francophone, l'affichage en FCFA, la disponibilité de Mobile Money et la procédure de vérification peuvent varier. Les méthodes visibles dans la caisse Linebet sont les seules que nous considérons comme disponibles. Une page partenaire peut orienter vers une offre, mais elle ne peut pas modifier les règles de l'opérateur.",
    "LiveFoot publie ce guide dans un objectif de comparaison et de transparence. Le site peut percevoir une commission d'affiliation si un lecteur s'inscrit avec notre lien, sans supplément automatique pour le lecteur. Cette relation commerciale ne change pas les probabilités de nos analyses et ne transforme pas une promotion en garantie de résultat.",
    "Avant toute utilisation, vérifiez l'âge légal, la réglementation applicable dans votre pays et votre budget de divertissement. Ne poursuivez pas une perte, ne financez jamais un compte avec de l'argent nécessaire aux dépenses courantes et utilisez les limites disponibles lorsque la plateforme en propose.",
  ],
  steps: [
    "Ouvrez Linebet depuis le bouton partenaire de cette page et vérifiez que le domaine affiché est bien celui de l'opérateur.",
    "Choisissez le pays et la devise proposés pour votre résidence réelle ; ne contournez pas les contrôles géographiques.",
    "Créez un nouveau compte avec vos informations exactes et un numéro de téléphone que vous contrôlez.",
    "Saisissez PREDAT dans le champ prévu pour le code promotionnel avant de valider l'inscription.",
    "Vérifiez la confirmation du code et ouvrez la rubrique Promotions pour lire le plafond, le dépôt minimum et le délai.",
    "Ne déposez qu'après avoir compris les conditions, puis conservez une copie de la promotion affichée au moment de l'activation.",
  ],
  bonusTable: [
    { label: "Partenaire", value: "Linebet" },
    { label: "Code promo", value: "PREDAT" },
    { label: "Montant de l'offre", value: "À vérifier selon le pays et la campagne active" },
    { label: "Dépôt minimum", value: "À vérifier dans le compte avant le dépôt" },
    {
      label: "Éligibilité",
      value: "Généralement nouveaux comptes, sous réserve des conditions Linebet",
    },
    { label: "Validité", value: "Délai indiqué dans la promotion après son activation" },
    { label: "Paiements", value: "Méthodes affichées dans la caisse pour votre pays" },
    { label: "Retrait", value: "Selon vérification du compte et règles de l'opérateur" },
    {
      label: "Dernière vérification éditoriale",
      value: "9 août 2026 — offre à confirmer à l'inscription",
    },
  ],
  terms: [
    "PREDAT doit être saisi pendant l'inscription ; un code oublié ne peut pas toujours être ajouté après la création du compte.",
    "Le montant, la devise et le plafond de l'offre peuvent varier selon le pays, la campagne et le profil éligible.",
    "Une seule offre de bienvenue est généralement autorisée par personne, foyer, appareil, adresse IP ou moyen de paiement.",
    "Le dépôt minimum et la période d'activation doivent être lus dans la promotion affichée avant toute transaction.",
    "Le bonus peut être soumis à un multiplicateur de mise, à une cote minimale, à un nombre de sélections ou à des marchés exclus.",
    "Les paris annulés, remboursés ou clôturés avant le résultat peuvent ne pas compter dans les exigences de mise.",
    "Un contrôle d'identité peut être demandé avant un retrait ; les informations du compte doivent donc être exactes.",
    "Les conditions de Linebet et les règles locales prévalent sur ce résumé éditorial si elles changent après la mise à jour de la page.",
    "Un bonus n'est pas un solde immédiatement retirable et ne garantit aucun gain.",
  ],
  sections: [
    {
      id: "code-predat",
      title: "Quel est le code promo Linebet actuel ?",
      paragraphs: [
        "Le code partenaire présenté dans ce guide est PREDAT. Il sert à relier votre inscription à l'offre partenaire Linebet lorsque le champ promotionnel est disponible. Saisissez-le sans espace, puis contrôlez la confirmation visuelle avant de poursuivre. Une capture de l'écran d'activation peut être utile si vous devez ensuite demander une vérification au support.",
        "Le code n'est pas une réduction universelle ni un ticket qui ajoute automatiquement un montant identique à tous les comptes. Son effet dépend de la campagne associée et des règles affichées dans votre pays. C'est pourquoi LiveFoot met le code en évidence tout en séparant clairement le code, le montant annoncé et les conditions réellement applicables.",
      ],
      bullets: [
        "Code à copier : PREDAT",
        "Saisie : pendant l'inscription",
        "Contrôle : rubrique Promotions du compte",
      ],
      cta: {
        title: "Ouvrir l'inscription Linebet",
        text: "Utilisez le lien partenaire, saisissez PREDAT puis vérifiez l'offre affichée avant de déposer.",
        label: "S'inscrire avec PREDAT",
      },
    },
    {
      id: "montant-offre",
      title: "Quel montant de bonus Linebet peut-on obtenir ?",
      paragraphs: [
        "Nous ne publions pas de chiffre fixe lorsqu'il n'est pas confirmé pour tous les pays. Une offre peut présenter un pourcentage, un plafond, un pari gratuit ou une combinaison de mécanismes. Le chiffre visible sur une ancienne bannière ne doit pas être considéré comme valable pour une campagne actuelle.",
        "Pour identifier le montant applicable, regardez trois endroits : le formulaire d'inscription, l'écran de confirmation et la rubrique Promotions après connexion. Comparez la devise, le dépôt minimum et le solde bonus. Si une information est ambiguë, demandez une confirmation au support avant de verser de l'argent.",
      ],
      table: {
        head: ["Élément", "Question à poser avant le dépôt"],
        rows: [
          ["Plafond", "Quel est le maximum réellement crédité ?"],
          ["Dépôt", "Quel montant active la promotion ?"],
          ["Délai", "Combien de temps ai-je pour remplir les règles ?"],
          ["Conversion", "Quand le bonus devient-il retirable ?"],
        ],
      },
    },
    {
      id: "inscription",
      title: "Comment s'inscrire sur Linebet avec PREDAT ?",
      paragraphs: [
        "Commencez par le lien partenaire de LiveFoot afin d'arriver sur le parcours correspondant à la campagne. Sur le formulaire, utilisez vos propres coordonnées et sélectionnez votre pays réel. Les informations inventées, les comptes multiples et les changements de pays peuvent bloquer la vérification ou annuler l'éligibilité à une offre.",
        "Avant de cliquer sur le bouton final, recherchez le champ Code promo, Promo code ou Bonus code. Selon l'interface, il peut être masqué derrière une option promotionnelle. Saisissez PREDAT, puis vérifiez que le code est accepté. Si le champ n'apparaît pas, ne le remplacez pas par un autre code : contactez le support ou revenez au parcours partenaire.",
      ],
      sub: [
        {
          id: "avant-validation",
          title: "La vérification à faire avant de valider",
          paragraphs: [
            "Relisez le pays, la devise, l'adresse e-mail et le numéro de téléphone. Vérifiez ensuite le récapitulatif de la campagne. Une minute de contrôle évite de déposer sur un compte qui n'a pas reconnu le code ou qui affiche une promotion différente de celle recherchée.",
          ],
          bullets: [
            "Nom et date de naissance exacts",
            "Pays de résidence réel",
            "PREDAT visible ou accepté",
            "Conditions accessibles depuis le compte",
          ],
        },
      ],
    },
    {
      id: "pays-devise",
      title: "Linebet par pays : pourquoi l'offre change-t-elle ?",
      paragraphs: [
        "Une page par pays est utile parce qu'un même partenaire ne présente pas nécessairement le même parcours au Cameroun, en Côte d'Ivoire ou au Sénégal. La devise, les opérateurs de paiement, les exigences d'identité, les limites de transaction et la campagne marketing peuvent être localisés. Le pays choisi dans le compte est donc un paramètre fonctionnel, pas seulement un élément de référencement.",
        "LiveFoot conserve une structure dédiée pour ces marchés afin de répondre aux questions locales sans dupliquer artificiellement le contenu. Les pages Linebet par pays rappellent le code PREDAT, les points de contrôle et les méthodes de paiement à vérifier. Elles ne promettent pas un bonus identique à tous les visiteurs et renvoient toujours aux conditions de l'offre active.",
      ],
      bullets: [
        "Cameroun : contrôler XAF et les options Mobile Money affichées",
        "Côte d'Ivoire : contrôler XOF et les méthodes proposées",
        "Sénégal : contrôler XOF, l'identité et les limites du compte",
      ],
    },
    {
      id: "paiements-mobile-money",
      title: "Paiements Linebet et Mobile Money en Afrique francophone",
      paragraphs: [
        "La possibilité de déposer ou de retirer avec Mobile Money dépend de l'intégration active dans votre pays. Orange Money, MTN, Moov, Wave ou une autre méthode peuvent apparaître selon le compte ; il serait imprudent de garantir un opérateur sans le voir dans la caisse. Utilisez uniquement un moyen de paiement à votre nom et conservez les références de transaction.",
        "Lors d'un dépôt, comparez le montant saisi dans Linebet avec le montant confirmé par votre portefeuille. Lors d'un retrait, vérifiez le numéro bénéficiaire, les frais éventuels, le minimum et le délai annoncé. Une transaction en attente ne doit pas être répétée immédiatement : consultez d'abord l'historique et le support afin d'éviter un doublon.",
      ],
      sub: [
        {
          id: "controle-caisse",
          title: "La caisse est la source de vérité",
          paragraphs: [
            "Les logos et les textes d'un article expliquent un parcours, mais la caisse connectée détermine les méthodes réellement activées. Si un moyen de paiement n'est pas visible, ne partagez jamais vos codes secrets et ne payez pas un intermédiaire qui prétend l'activer pour vous.",
          ],
        },
      ],
    },
    {
      id: "conditions-mise",
      title: "Comprendre les conditions de mise du bonus",
      paragraphs: [
        "Une promotion de bienvenue comporte souvent plusieurs règles qui doivent être lues ensemble. Le dépôt peut devoir être effectué avec un moyen éligible, le bonus peut avoir une durée limitée et les paris peuvent devoir respecter une cote ou un marché précis. Une phrase comme « bonus disponible » ne signifie pas que le solde bonus est retirable immédiatement.",
        "Le multiplicateur de mise est particulièrement important. Si une promotion impose de rejouer le bonus ou le dépôt plusieurs fois, calculez la somme totale demandée avant de l'accepter. Prenez aussi en compte les paris annulés, les cash-outs, les combinés et les cotes qui peuvent être exclus. En cas de doute, privilégiez une offre plus simple et refusez une condition que vous ne comprenez pas.",
      ],
      bullets: [
        "Lire le délai exact",
        "Identifier les marchés et paris exclus",
        "Vérifier la cote minimale et le nombre de sélections",
        "Confirmer le moment où le solde devient retirable",
      ],
    },
    {
      id: "football-live",
      title: "Linebet pour les paris football et le live",
      paragraphs: [
        "Linebet peut proposer une interface consacrée au football et aux événements en direct, mais la couverture exacte dépend du pays et du calendrier. Avant de sélectionner un marché, vérifiez l'heure de coup d'envoi, le statut du match, les règles d'annulation et les limites affichées. Les cotes évoluent : une valeur observée dans une analyse LiveFoot n'est pas une cote garantie au moment de votre connexion.",
        "L'analyse LiveFoot et la plateforme partenaire ont des rôles différents. LiveFoot aide à comparer forme, historique, absences et probabilités ; Linebet affiche ses marchés et applique ses propres règles. Utilisez le bouton Analyser pour préparer votre lecture, puis décidez de manière autonome. Aucun signal statistique ne supprime le risque d'une perte.",
      ],
      cta: {
        title: "Préparez votre lecture du match",
        text: "Consultez les données LiveFoot avant d'ouvrir un marché, puis comparez toujours la cote et les règles affichées par l'opérateur.",
        label: "Analyser un match",
      },
    },
    {
      id: "retraits-kyc",
      title: "Retrait, vérification et sécurité du compte",
      paragraphs: [
        "Un retrait peut être soumis à une vérification d'identité, notamment lorsque le montant, le moyen de paiement ou l'activité du compte déclenche un contrôle. Préparez uniquement des documents demandés dans l'espace officiel et vérifiez l'adresse du site avant de les transmettre. LiveFoot ne demande jamais votre mot de passe, votre code Mobile Money ou une copie de carte par messagerie.",
        "La procédure la plus sûre consiste à utiliser le même moyen de paiement que celui autorisé par les conditions, à contrôler le nom du titulaire et à consulter l'historique avant toute relance. Les délais annoncés sont indicatifs : une transaction peut rester en attente à cause d'un contrôle, d'un opérateur de paiement ou d'un jour non ouvré.",
      ],
      bullets: [
        "Activer un mot de passe unique",
        "Ne jamais partager un code OTP",
        "Vérifier le domaine avant une connexion",
        "Contacter le support depuis l'espace officiel",
      ],
    },
    {
      id: "mobile-experience",
      title: "Expérience mobile : inscription et lecture confortable",
      paragraphs: [
        "La majorité des visiteurs consultent les offres depuis un téléphone. Le parcours doit donc rester lisible sans zoom : code PREDAT visible, bouton d'inscription identifiable, conditions accessibles et retour simple vers l'analyse. Si le formulaire se recharge ou si le champ promotionnel disparaît, prenez le temps de vérifier l'état du compte plutôt que de créer une seconde inscription.",
        "Avant un dépôt mobile, utilisez une connexion fiable et désactivez les extensions qui modifient les formulaires. Un navigateur à jour réduit les erreurs de session. Les notifications, liens entrants et publicités ne doivent jamais vous faire installer une application provenant d'une source inconnue.",
      ],
    },
    {
      id: "code-ne-marche-pas",
      title: "Que faire si le code PREDAT ne fonctionne pas ?",
      paragraphs: [
        "Commencez par vérifier l'orthographe : PREDAT, en majuscules, sans espace avant ou après. Ensuite, confirmez que vous êtes dans un parcours de nouveau compte, que le pays est correct et que la promotion est encore active. Certains formulaires n'affichent le champ qu'après l'ouverture d'une section bonus.",
        "Si le code est refusé, ne multipliez pas les comptes et ne déposez pas en espérant une régularisation automatique. Faites une capture non sensible de l'erreur, notez l'heure et contactez le support Linebet depuis le domaine officiel. Le support est le seul interlocuteur pouvant confirmer l'éligibilité d'un compte ou corriger une campagne.",
      ],
      bullets: [
        "Retaper PREDAT manuellement",
        "Vérifier le pays et le statut nouveau client",
        "Lire le message d'erreur exact",
        "Contacter Linebet avant tout dépôt",
      ],
    },
    {
      id: "avis-livefoot",
      title: "Notre avis éditorial sur Linebet et PREDAT",
      paragraphs: [
        "L'intérêt de PREDAT est d'offrir un parcours clairement identifié et de centraliser les étapes à vérifier. Le point fort de cette présentation est sa prudence : au lieu d'afficher un plafond non confirmé, nous indiquons les informations qui déterminent réellement l'offre. Cela permet au lecteur de comparer une promotion sur des critères concrets : lisibilité, dépôt demandé, délai, conversion et paiements disponibles.",
        "Nous ne considérons pas une offre comme intéressante uniquement parce que son montant annoncé est élevé. Une promotion avec une règle trop complexe peut avoir moins de valeur qu'une offre plus modeste mais compréhensible. Notre recommandation est donc de comparer la valeur nette, le risque de blocage et la compatibilité avec votre budget avant de cliquer sur le bouton de confirmation.",
      ],
    },
    {
      id: "comparaison",
      title: "Comment comparer Linebet avec les autres partenaires ?",
      paragraphs: [
        "La comparaison doit partir de votre besoin : football international, compétitions africaines, paris en direct, moyens de paiement, rapidité de l'interface ou simplicité du bonus. Un code différent ne signifie pas nécessairement une meilleure offre. Lisez les conditions de chaque page et vérifiez le montant réellement affiché pour votre pays.",
        "Sur LiveFoot, les pages partenaires sont présentées avec une structure homogène afin de comparer les mêmes champs. Vous pouvez examiner le code, le type de bonus, les méthodes à vérifier, les limites et les points de vigilance. La présence d'un partenaire dans le catalogue ne constitue ni une garantie, ni une recommandation financière personnalisée.",
      ],
      table: {
        head: ["Critère", "Pourquoi le comparer"],
        rows: [
          ["Code et activation", "Éviter une inscription sans promotion"],
          ["Montant réel", "Séparer le plafond marketing du crédit applicable"],
          ["Conditions", "Estimer le volume de mise nécessaire"],
          ["Paiements", "Vérifier la compatibilité avec votre pays"],
          ["Support et KYC", "Anticiper un contrôle ou un retrait en attente"],
        ],
      },
    },
    {
      id: "methode-livefoot",
      title: "Méthode de vérification et transparence LiveFoot",
      paragraphs: [
        "Chaque fiche partenaire sépare les données fournies par l'opérateur, les informations à vérifier dans le compte et les conseils de lecture de LiveFoot. Cette distinction est importante pour le SEO comme pour la confiance : un moteur de recherche ou un assistant peut comprendre l'offre sans confondre une hypothèse éditoriale avec une condition contractuelle.",
        "La date de mise à jour indique quand la page a été relue. Elle ne transforme pas une promotion variable en garantie permanente. Lorsqu'une campagne évolue, nous préférons corriger le montant, marquer l'élément comme variable et conserver les questions fréquentes utiles plutôt que de recycler une promesse ancienne.",
      ],
      bullets: [
        "Montants non confirmés présentés comme variables",
        "Conditions résumées sans remplacer le règlement officiel",
        "Lien partenaire identifié clairement",
        "Avertissement 18+ et usage responsable",
      ],
    },
    {
      id: "usage-responsable",
      title: "Utiliser une offre de bienvenue de façon responsable",
      paragraphs: [
        "Une offre promotionnelle ne doit jamais servir de justification pour augmenter une mise ou récupérer une perte. Fixez une limite avant de commencer, utilisez une somme dont la perte ne compromet pas votre quotidien et arrêtez-vous lorsque votre limite est atteinte. Les analyses statistiques servent à organiser l'information, pas à prédire avec certitude un résultat.",
        "Si vous sentez que l'activité devient difficile à contrôler, interrompez-la et cherchez une aide adaptée dans votre pays. Les outils de limitation, d'auto-exclusion et de pause proposés par l'opérateur peuvent être utilisés à tout moment. LiveFoot réserve ses contenus liés aux partenaires aux personnes majeures et rappelle que les règles locales doivent être respectées.",
      ],
    },
  ],
  pros: [
    "Code PREDAT clairement identifiable pendant l'inscription",
    "Pages localisées pour le Cameroun, la Côte d'Ivoire et le Sénégal",
    "Guide transparent sur le montant et les conditions à vérifier",
    "Parcours mobile et liens vers l'analyse LiveFoot",
    "Comparaison structurée avec les autres partenaires du catalogue",
  ],
  cons: [
    "Montant du bonus non garanti et variable selon le pays",
    "Dépôt minimum, délai et multiplicateur à confirmer dans le compte",
    "Disponibilité des paiements différente selon la juridiction",
    "Un code oublié peut être impossible à ajouter après inscription",
    "Une promotion ne garantit ni gain ni retrait immédiat",
  ],
  faq: [
    {
      q: "Quel est le code promo Linebet sur LiveFoot ?",
      a: "Le code partenaire Linebet présenté par LiveFoot est PREDAT. Saisissez-le pendant la création du compte, puis vérifiez dans la rubrique Promotions que l'offre associée est bien active.",
    },
    {
      q: "Quel est le montant du bonus Linebet avec PREDAT ?",
      a: "Le montant dépend du pays, de la devise et de la campagne active. LiveFoot ne présente pas de chiffre fixe non confirmé : l'offre affichée dans le formulaire et le compte Linebet fait foi.",
    },
    {
      q: "Quand faut-il entrer le code PREDAT ?",
      a: "PREDAT doit être saisi pendant l'inscription, avant la validation définitive du compte. Vérifiez que le code est accepté et que la promotion est visible avant d'effectuer un dépôt.",
    },
    {
      q: "Linebet est-il disponible au Cameroun, en Côte d'Ivoire et au Sénégal ?",
      a: "LiveFoot propose une page localisée pour ces trois pays. La disponibilité du compte, de la devise, des paiements et du bonus doit toutefois être confirmée dans le parcours officiel correspondant à votre résidence.",
    },
    {
      q: "Peut-on payer avec Mobile Money ?",
      a: "Les méthodes de paiement sont déterminées par le pays et le compte. Vérifiez la caisse Linebet : seuls les moyens visibles dans votre interface sont disponibles pour votre profil.",
    },
    {
      q: "Le bonus Linebet est-il retirable immédiatement ?",
      a: "Non, pas nécessairement. Un bonus peut imposer un délai, un multiplicateur de mise, une cote minimale ou d'autres conditions avant qu'une partie du solde devienne retirable.",
    },
    {
      q: "Que faire si PREDAT est refusé ?",
      a: "Vérifiez l'orthographe, le pays, le statut de nouveau client et la période de la campagne. Ne créez pas un second compte ; contactez Linebet depuis son support officiel avant tout dépôt.",
    },
    {
      q: "LiveFoot garantit-il un gain avec Linebet ?",
      a: "Non. LiveFoot fournit des informations, des analyses et un guide promotionnel. Aucun code, aucune cote et aucune prédiction ne garantit un résultat ou un gain.",
    },
    {
      q: "Pourquoi le montant peut-il être différent d'un pays à l'autre ?",
      a: "Les campagnes, devises, règles locales, méthodes de paiement et critères d'éligibilité peuvent être localisés. Le montant affiché dans votre compte est la référence à retenir.",
    },
  ],
});
