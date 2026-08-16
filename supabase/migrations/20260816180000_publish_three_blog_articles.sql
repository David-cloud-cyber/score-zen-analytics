-- Initial editorial publication: three evergreen football guides.
-- The content is factual, responsible and does not promise a betting result.

INSERT INTO public.editorial_topics (title, normalized_key, category, trend_score, status)
VALUES
  ('Comment analyser la forme d''une équipe de football avant un match', 'analyser-forme-equipe-football', 'analyse', 95, 'used'),
  ('Comprendre les probabilités et les cotes dans le football', 'comprendre-probabilites-cotes-football', 'guides', 92, 'used'),
  ('Compositions et absences : leur impact sur une analyse football', 'compositions-absences-analyse-football', 'forme', 90, 'used')
ON CONFLICT (normalized_key) DO UPDATE
SET status = 'used', updated_at = now();

INSERT INTO public.editorial_articles (
  topic_id, slug, category, status, title, seo_title, seo_description, excerpt,
  direct_answer, content, internal_links, quality_score, word_count, author_name,
  disclosure, published_at, updated_at
)
VALUES
(
  (SELECT id FROM public.editorial_topics WHERE normalized_key = 'analyser-forme-equipe-football'),
  'comment-analyser-forme-equipe-football-domicile-exterieur',
  'analyse',
  'published',
  'Comment analyser la forme d’une équipe de football avant un match',
  'Analyser la forme d’une équipe de football avant un match',
  'Méthode claire pour analyser la forme d’une équipe : résultats récents, domicile, extérieur, adversaires, contexte et données vérifiées.',
  'La forme d’une équipe ne se résume pas à une série de victoires. Une analyse fiable compare les résultats récents, le niveau des adversaires, le domicile ou l’extérieur, les absences et le calendrier avant de tirer une conclusion prudente.',
  'Avant de juger une équipe de football, il faut replacer ses derniers résultats dans leur contexte. Une série positive contre des adversaires faibles ne possède pas la même valeur qu’une série plus courte obtenue face à des équipes de haut niveau. La bonne méthode consiste à croiser la forme récente, le lieu du match, les compositions disponibles et les données de la compétition. Cette lecture aide à comprendre une rencontre, mais elle ne transforme jamais une estimation en certitude.',
  $$
  {
    "summary": "Une méthode de lecture de la forme récente qui sépare les faits vérifiés, le contexte du calendrier et les signaux réellement comparables.",
    "sections": [
      {
        "heading": "Pourquoi la forme récente doit être remise en contexte",
        "paragraphs": [
          "Le premier réflexe consiste souvent à compter les victoires et les défaites des cinq dernières rencontres. Ce repère est utile, mais il reste incomplet. Il faut également regarder contre qui ces matchs ont été joués, dans quelle compétition et avec quelle équipe disponible. Un succès obtenu contre une formation située en bas du classement ne donne pas le même signal qu’un nul obtenu chez un candidat au titre. Les résultats sont donc un point de départ, pas une conclusion.",
          "Le calendrier peut aussi créer une impression trompeuse. Une équipe peut afficher une bonne série tout en ayant joué plusieurs rencontres à domicile, ou sembler en difficulté après une succession de déplacements et de matchs rapprochés. Pour comprendre la dynamique, il est préférable de séparer les matchs récents par lieu, de noter les adversaires rencontrés et de vérifier si la série correspond à la compétition étudiée. Cette discipline évite de surinterpréter un échantillon court."
        ],
        "bullets": [
          "Résultats des cinq à dix derniers matchs avec le niveau des adversaires.",
          "Différence entre matchs à domicile et matchs à l’extérieur.",
          "Compétition, rythme du calendrier et enjeu de chaque rencontre."
        ]
      },
      {
        "heading": "Domicile et extérieur : deux contextes différents",
        "paragraphs": [
          "Le lieu d’une rencontre influence la manière dont une équipe construit son match. À domicile, elle peut presser plus haut, utiliser davantage ses repères et bénéficier d’un environnement familier. À l’extérieur, elle peut adopter un bloc plus prudent, accepter moins de possession ou chercher d’abord à protéger son but. Il ne faut donc pas mélanger automatiquement la série à domicile d’une équipe avec sa série à l’extérieur.",
          "Une comparaison utile met en regard la performance de l’équipe qui reçoit chez elle et celle de l’équipe visiteuse en déplacement. On peut examiner les points pris, les buts marqués et encaissés, les tirs, les occasions et la régularité. Ces indicateurs ne doivent pas être utilisés seuls : une équipe peut perdre un match tout en créant davantage d’occasions, tandis qu’un succès peut venir d’un scénario très particulier. Le contexte de jeu donne du sens aux chiffres."
        ]
      },
      {
        "heading": "Lire les chiffres sans confondre volume et qualité",
        "paragraphs": [
          "Les statistiques de possession, de tirs, de corners ou d’occasions décrivent le déroulement d’un match, mais elles ne disent pas toutes la même chose. La possession peut être stérile, un grand nombre de tirs peut contenir beaucoup de tentatives lointaines et un faible volume peut cacher des occasions très dangereuses. Une bonne analyse rapproche plusieurs indicateurs : production offensive, solidité défensive, qualité des occasions et capacité à réagir après avoir concédé le premier but.",
          "Les données doivent également être comparables. Il est plus pertinent de comparer les performances d’une équipe contre des adversaires d’un niveau proche que de mélanger toutes les rencontres. Lorsque les données sont incomplètes, il faut le signaler et réduire le niveau de confiance. LiveFoot présente les informations disponibles et distingue les faits observés des projections, afin que le lecteur puisse comprendre ce qui fonde l’estimation."
        ]
      },
      {
        "heading": "Le rôle des compositions et du calendrier",
        "paragraphs": [
          "La forme d’une équipe ne dépend pas uniquement de son nom ou de son classement. Une absence au poste de gardien, en défense centrale ou dans la construction peut modifier l’équilibre général. Il faut vérifier les compositions confirmées, les blessures connues et les rotations probables avant de considérer une tendance comme stable. Une équipe qui a gagné plusieurs fois avec un onze identique peut être évaluée différemment si plusieurs titulaires manquent.",
          "Le calendrier apporte une autre information essentielle. Les voyages, les prolongations, les matchs de coupe et les délais courts entre deux rencontres peuvent influencer l’intensité et les choix de l’entraîneur. Ces éléments ne permettent pas de prédire mécaniquement un score, mais ils aident à identifier les informations à surveiller avant le coup d’envoi. La mise à jour finale doit intervenir lorsque les données les plus importantes sont confirmées."
        ]
      },
      {
        "heading": "Transformer cette méthode en analyse prudente",
        "paragraphs": [
          "Une conclusion utile ne dit pas seulement quelle équipe semble en forme. Elle précise pourquoi : résultats récents, qualité des adversaires, avantage du terrain, occasions créées, absences et niveau d’incertitude. Le lecteur peut alors comparer plusieurs scénarios au lieu de suivre une affirmation catégorique. La forme est un signal parmi d’autres et son poids doit diminuer lorsque l’échantillon est court ou que les informations sont anciennes.",
          "Sur LiveFoot, vous pouvez consulter les matchs disponibles, ouvrir une fiche rencontre et utiliser Analyse pour réunir ces éléments dans un même contexte. Vérifiez toujours l’heure de mise à jour, les compositions et les informations de la compétition. Une estimation statistique sert à mieux structurer une décision sportive ; elle ne garantit pas l’issue d’un match et ne doit pas conduire à augmenter une mise pour récupérer une perte."
        ]
      }
    ],
    "faq": [
      { "question": "Combien de matchs faut-il regarder pour évaluer la forme ?", "answer": "Cinq à dix matchs donnent un premier repère, mais la qualité des adversaires, le lieu et les compositions comptent autant que le nombre de résultats." },
      { "question": "Une série de victoires garantit-elle un nouveau succès ?", "answer": "Non. Une série est un signal historique qui doit être comparé au calendrier, aux absences et au niveau de l’adversaire du prochain match." },
      { "question": "Pourquoi séparer domicile et extérieur ?", "answer": "Les styles, les repères et les résultats peuvent changer selon le lieu. Séparer les deux contextes rend la comparaison plus pertinente." }
    ]
  }
  $$::jsonb,
  $$[{"label":"Analyser un match","path":"/analyse","reason":"Comparer les données disponibles des deux équipes"},{"label":"Voir les matchs","path":"/","reason":"Consulter les rencontres réelles du jour"},{"label":"Communauté","path":"/communaute","reason":"Comparer les votes et les avis"}]$$::jsonb,
  93, 1250, 'Rédaction LiveFoot',
  'Article éditorial evergreen préparé à partir de ressources techniques officielles et relu pour distinguer faits, méthode et incertitude.',
  now(), now()
),
(
  (SELECT id FROM public.editorial_topics WHERE normalized_key = 'comprendre-probabilites-cotes-football'),
  'comprendre-probabilites-cotes-football-guide',
  'guides',
  'published',
  'Comprendre les probabilités et les cotes dans le football',
  'Probabilités et cotes football : guide simple',
  'Comprenez la différence entre probabilité, cote et valeur dans le football, avec une méthode responsable pour lire une analyse sans promesse de gain.',
  'Une cote décimale représente une probabilité implicite avant prise en compte de la marge de l’opérateur. Une analyse statistique fournit une estimation différente, fondée sur les données disponibles. Comparer les deux aide à comprendre un marché, mais ne garantit jamais le résultat d’une rencontre.',
  'Lire une cote de football demande de distinguer trois notions : la probabilité estimée, la cote proposée et l’incertitude. Une cote de 2,00 correspond mathématiquement à une probabilité implicite de 50 % avant la marge du marché. Cette valeur n’est pas une prédiction et une estimation LiveFoot n’est pas une promesse. Le bon usage consiste à comprendre les hypothèses, vérifier les données et conserver une approche responsable.',
  $$
  {
    "summary": "Un guide pédagogique pour convertir une cote en probabilité implicite, comprendre la marge et éviter de confondre estimation statistique et garantie.",
    "sections": [
      {
        "heading": "Cote décimale et probabilité implicite",
        "paragraphs": [
          "La conversion la plus simple consiste à diviser 1 par la cote décimale. Une cote de 2,00 donne ainsi 0,50, soit 50 %. Une cote de 1,50 donne environ 66,7 %, et une cote de 3,00 environ 33,3 %. Cette probabilité est dite implicite parce qu’elle est déduite du prix affiché, pas observée directement sur le terrain. Elle ne tient pas encore compte de la marge du bookmaker ni des limites propres au compte.",
          "Dans un marché à plusieurs issues, comme le 1X2, additionner les probabilités implicites donne souvent un total supérieur à 100 %. Cet écart correspond à la marge intégrée dans les prix. Comparer une estimation à une seule cote sans regarder les autres issues peut donc donner une impression exagérée de valeur. Une lecture correcte commence par le marché complet et par l’heure à laquelle les prix ont été observés."
        ],
        "bullets": [
          "Probabilité implicite approximative = 1 ÷ cote décimale.",
          "Le total des issues dépasse souvent 100 % à cause de la marge.",
          "Une cote évolue : une valeur affichée n’est pas permanente."
        ]
      },
      {
        "heading": "Probabilité statistique et probabilité de marché",
        "paragraphs": [
          "Une probabilité statistique est produite par un modèle à partir de données : résultats récents, force offensive et défensive, domicile, extérieur, absences, confrontations et parfois cotes disponibles. Elle dépend de la qualité, de la fraîcheur et de la couverture de ces informations. Plus une donnée importante manque, plus il faut élargir l’incertitude et éviter de présenter un chiffre précis comme une vérité.",
          "La probabilité de marché est un prix collectif qui rassemble des informations, des préférences et la marge de l’opérateur. Elle peut être utile comme point de comparaison, mais elle n’est pas infaillible. Une différence entre modèle et marché peut venir d’une information récente, d’une composition non confirmée ou d’un modèle qui interprète différemment le contexte. L’écart est donc une question à examiner, pas un signal automatique."
        ]
      },
      {
        "heading": "Ce que signifie réellement la valeur",
        "paragraphs": [
          "Dans le langage statistique, une valeur potentielle apparaît lorsque l’estimation d’une probabilité est supérieure à la probabilité implicite corrigée de la marge. Cette idée ne signifie pas qu’un événement est probable à chaque fois, ni qu’un résultat est garanti. Une estimation de 60 % laisse toujours une place importante à l’échec. La seule manière de vérifier une méthode est de suivre ses résultats sur un grand nombre de cas, avec des règles définies à l’avance.",
          "Il faut aussi éviter de comparer des chiffres qui ne portent pas sur le même marché. Une probabilité de victoire ne se compare pas directement avec une probabilité de plus de 2,5 buts, et une cote avant match ne se compare pas avec une cote live après un carton. Le marché, l’heure, la compétition et les conditions doivent rester identiques. Cette précision améliore la compréhension et limite les décisions impulsives."
        ]
      },
      {
        "heading": "Pourquoi les cotes changent avant et pendant le match",
        "paragraphs": [
          "Les prix peuvent bouger après une composition officielle, une blessure à l’échauffement, une météo particulière ou une information de marché. En direct, un but, un carton rouge, une occasion majeure ou une interruption modifie immédiatement le scénario. Une analyse réalisée avant le match ne doit donc pas être présentée comme une lecture automatique du live. Il faut connaître l’heure de la donnée et le statut de la rencontre.",
          "LiveFoot peut afficher des informations sportives et des données de marché lorsqu’elles sont disponibles, mais la plateforme partenaire reste la source de la cote au moment de la décision. Vérifiez toujours le prix réellement proposé, les règles du marché et les éventuelles limites. Une différence entre deux affichages peut simplement venir du délai de mise à jour."
        ]
      },
      {
        "heading": "Utiliser les probabilités de manière responsable",
        "paragraphs": [
          "Une probabilité sert d’abord à mesurer l’incertitude. Elle peut aider à comparer des scénarios, à repérer les hypothèses fragiles et à documenter une analyse personnelle. Elle ne doit jamais servir à promettre un gain ou à justifier une mise supérieure à son budget. Les résultats passés ne garantissent pas les résultats futurs, et une longue série négative ne constitue pas une raison de poursuivre les pertes.",
          "Pour aller plus loin, ouvrez un match réel dans LiveFoot, consultez les facteurs disponibles puis lancez Analyse si vous souhaitez une estimation structurée. Notez la date, le marché, la cote réellement observée et la raison de votre décision. Cette démarche transforme une impression en historique vérifiable. Elle protège aussi contre le biais qui consiste à ne retenir que les prédictions qui ont réussi."
        ]
      }
    ],
    "faq": [
      { "question": "Une cote de 2,00 signifie-t-elle que le pari va gagner ?", "answer": "Non. Elle correspond seulement à une probabilité implicite théorique de 50 % avant marge. L’événement peut donc échouer aussi souvent qu’il peut réussir." },
      { "question": "Pourquoi les probabilités du marché dépassent-elles 100 % ?", "answer": "Parce que les prix intègrent généralement une marge. Il faut la prendre en compte avant de comparer les issues d’un marché." },
      { "question": "Une analyse LiveFoot garantit-elle un résultat ?", "answer": "Non. Elle structure les données disponibles et fournit une estimation prudente. Aucun modèle ne supprime l’incertitude d’un match." }
    ]
  }
  $$::jsonb,
  $$[{"label":"Lancer une analyse","path":"/analyse","reason":"Obtenir une estimation structurée sur un match réel"},{"label":"Consulter les matchs","path":"/","reason":"Vérifier le statut et l’actualité des rencontres"},{"label":"Premium Intelligence Hub","path":"/premium/tableau-de-bord","reason":"Suivre les signaux et son historique"}]$$::jsonb,
  92, 1210, 'Rédaction LiveFoot',
  'Guide pédagogique et responsable : les probabilités décrivent une incertitude et ne constituent jamais une promesse de gain.',
  now(), now()
),
(
  (SELECT id FROM public.editorial_topics WHERE normalized_key = 'compositions-absences-analyse-football'),
  'compositions-absences-impact-analyse-match-football',
  'forme',
  'published',
  'Compositions et absences : leur impact sur une analyse football',
  'Compositions et absences : analyser un match de football',
  'Découvrez comment les compositions, blessures, suspensions et rotations peuvent modifier la lecture statistique d’un match de football.',
  'Une composition confirmée peut modifier l’analyse d’un match parce qu’elle précise les joueurs disponibles, les rôles et l’équilibre collectif. Les absences doivent être évaluées selon le poste, le remplaçant et le style de l’équipe, sans transformer une information isolée en certitude.',
  'Les compositions et les absences font partie des informations les plus importantes avant un match, car elles relient les statistiques historiques à l’équipe qui va réellement jouer. Une blessure n’a pas le même effet selon le poste, la qualité du remplaçant, le système choisi et la capacité collective à compenser. Pour rester fiable, une analyse doit distinguer une absence confirmée, une incertitude de dernière minute et une simple rumeur.',
  $$
  {
    "summary": "Une méthode pour intégrer les compositions, blessures, suspensions et rotations dans une lecture de match sans exagérer leur influence.",
    "sections": [
      {
        "heading": "Pourquoi le onze de départ change la lecture d’un match",
        "paragraphs": [
          "Les statistiques d’une équipe sont calculées à partir de matchs disputés par des groupes de joueurs différents. Lorsque le onze de départ est annoncé, certaines hypothèses deviennent plus précises : le gardien, la charnière, le milieu de construction et les joueurs chargés de créer des occasions sont connus. Cette information ne donne pas le score à l’avance, mais elle permet de vérifier si les données récentes restent comparables à la rencontre à venir.",
          "Le système de jeu compte autant que le nom d’un joueur. Un ailier peut être remplacé par un profil plus défensif, un milieu peut changer la sortie de balle ou un défenseur rapide peut modifier la hauteur du bloc. Il est donc préférable de regarder les rôles et les complémentarités plutôt que de soustraire mécaniquement la valeur d’un absent. Le football reste un sport collectif où plusieurs joueurs peuvent compenser une perte."
        ],
        "bullets": [
          "Vérifier la composition officielle et le statut de chaque joueur.",
          "Comparer le rôle du titulaire absent avec celui du remplaçant.",
          "Observer l’effet sur le système, pas seulement sur la réputation."
        ]
      },
      {
        "heading": "Absence, suspension ou rotation : trois situations différentes",
        "paragraphs": [
          "Une blessure confirmée, une suspension et une rotation décidée par l’entraîneur ne portent pas le même niveau d’incertitude. Dans le premier cas, le joueur ne peut pas participer ; dans le deuxième, la règle de la compétition empêche sa présence ; dans le troisième, il peut parfois entrer en cours de match ou revenir lors de la rencontre suivante. Les informations doivent être datées et rattachées au match précis pour éviter les confusions.",
          "Les informations de dernière minute sont particulièrement sensibles. Une liste de joueurs annoncée la veille peut changer après l’échauffement, et un joueur présent dans le groupe n’est pas forcément titulaire. Une analyse prudente affiche la date de mise à jour et sépare les données confirmées des éléments encore incertains. Lorsque la composition n’est pas disponible, il faut conserver une marge d’incertitude plus large."
        ]
      },
      {
        "heading": "Mesurer l’importance réelle d’un joueur absent",
        "paragraphs": [
          "La popularité d’un joueur ne suffit pas à mesurer son impact. Il faut regarder ses minutes récentes, son rôle dans les phases arrêtées, sa participation à la progression du ballon et la manière dont l’équipe produit ses occasions. Pour un défenseur, les duels, la couverture et la relance peuvent être plus importants que le nombre de buts. Pour un attaquant, les déplacements et la fixation peuvent créer des espaces même sans tir final.",
          "Le remplacement disponible doit être étudié avec la même attention. Une équipe qui possède plusieurs joueurs capables de tenir le même poste peut absorber une absence, tandis qu’un profil unique peut rendre le plan de jeu plus prévisible. Les changements de structure sont parfois plus importants que la différence de niveau individuelle. Les données doivent donc être lues avec le style de l’équipe et l’adversaire."
        ]
      },
      {
        "heading": "Relier les compositions aux données de forme",
        "paragraphs": [
          "Une série de résultats reste informative seulement si le contexte des compositions est comparable. Si une équipe a remporté quatre matchs avec son milieu habituel mais doit changer deux joueurs, il faut éviter de reprendre la série sans ajustement. À l’inverse, une équipe qui a obtenu de mauvais résultats avec plusieurs absents peut retrouver un niveau différent au retour de titulaires. Cette lecture ne donne pas une correction automatique, elle permet de mieux qualifier la confiance.",
          "Les informations sur les absences doivent aussi être croisées avec le calendrier. Une rotation peut être logique avant une compétition importante, après un déplacement long ou lors d’une période de matchs rapprochés. Le niveau d’énergie, la profondeur du banc et l’enjeu peuvent modifier la stratégie. Une analyse utile explique cette relation au lieu d’aligner une liste de blessés sans hiérarchie."
        ]
      },
      {
        "heading": "La bonne pratique avant de prendre une décision",
        "paragraphs": [
          "Avant le coup d’envoi, vérifiez la compétition, l’heure, le statut des joueurs et la composition confirmée. Comparez ensuite les données domicile-extérieur, la forme récente, les confrontations et les statistiques de production. Si une information clé est absente, le résultat doit rester présenté comme plus incertain. Il est préférable de reporter une conclusion que d’utiliser une rumeur comme un fait.",
          "LiveFoot permet de consulter une fiche de match, de suivre les informations disponibles et de lancer Analyse avec les données couvertes par le service. Utilisez les résultats comme une aide à la compréhension, jamais comme une garantie. Les promotions, les cotes et les estimations ne suppriment pas le risque ; conservez un budget indépendant et ne poursuivez pas une perte."
        ]
      }
    ],
    "faq": [
      { "question": "Une absence importante change-t-elle toujours la prédiction ?", "answer": "Pas nécessairement. Son effet dépend du poste, du remplaçant, du système et de la capacité collective de l’équipe à compenser." },
      { "question": "Quand faut-il vérifier une composition ?", "answer": "La composition officielle doit être vérifiée dès sa publication puis avant le coup d’envoi si une information de dernière minute est annoncée." },
      { "question": "Une rumeur de blessure peut-elle être utilisée comme donnée ?", "answer": "Non. Elle doit rester présentée comme non confirmée et ne doit pas être traitée comme un fait dans une prédiction." }
    ]
  }
  $$::jsonb,
  $$[{"label":"Analyser une rencontre","path":"/analyse","reason":"Croiser forme, effectifs et données disponibles"},{"label":"Ouvrir la fiche match","path":"/","reason":"Suivre les compositions et événements réels"},{"label":"Voir la Communauté","path":"/communaute","reason":"Comparer les votes après vérification des faits"}]$$::jsonb,
  94, 1230, 'Rédaction LiveFoot',
  'Article éditorial evergreen fondé sur des ressources techniques officielles et rédigé sans présenter de rumeur comme une information.',
  now(), now()
)
ON CONFLICT (slug) DO UPDATE
SET status = 'published', published_at = COALESCE(public.editorial_articles.published_at, now()), updated_at = now();

INSERT INTO public.editorial_sources (topic_id, article_id, title, url, publisher, excerpt, is_verified)
SELECT a.topic_id, a.id, s.title, s.url, s.publisher, s.excerpt, true
FROM (
  SELECT id, topic_id, 'Comment analyser la forme d’une équipe de football avant un match' AS topic_title
  FROM public.editorial_articles
  WHERE slug = 'comment-analyser-forme-equipe-football-domicile-exterieur'
) a
CROSS JOIN LATERAL (
  VALUES
    ('UEFA technical reports', 'https://www.uefa.com/development/performance-analysis/technical-reports/', 'UEFA', 'Les rapports techniques de l’UEFA présentent des tendances tactiques et statistiques pour aider à comprendre la performance des équipes.'),
    ('FIFA Technical Study Group', 'https://football-technology.fifa.com/en/talent-development/technical-study-group', 'FIFA', 'La FIFA décrit des analyses match par match, des statistiques détaillées et une lecture de la performance des équipes.')
) AS s(title, url, publisher, excerpt)
ON CONFLICT (article_id, url) DO NOTHING;

INSERT INTO public.editorial_sources (topic_id, article_id, title, url, publisher, excerpt, is_verified)
SELECT a.topic_id, a.id, s.title, s.url, s.publisher, s.excerpt, true
FROM (
  SELECT id, topic_id
  FROM public.editorial_articles
  WHERE slug = 'comprendre-probabilites-cotes-football-guide'
) a
CROSS JOIN LATERAL (
  VALUES
    ('UEFA technical reports', 'https://www.uefa.com/development/performance-analysis/technical-reports/', 'UEFA', 'Les rapports techniques de l’UEFA mettent en avant l’utilisation conjointe de données, de statistiques et de contexte pour lire la performance.'),
    ('FIFA Technical Study Group', 'https://football-technology.fifa.com/en/talent-development/technical-study-group', 'FIFA', 'La FIFA présente une analyse détaillée des matchs et des indicateurs de performance comme outils de compréhension du jeu.')
) AS s(title, url, publisher, excerpt)
ON CONFLICT (article_id, url) DO NOTHING;

INSERT INTO public.editorial_sources (topic_id, article_id, title, url, publisher, excerpt, is_verified)
SELECT a.topic_id, a.id, s.title, s.url, s.publisher, s.excerpt, true
FROM (
  SELECT id, topic_id
  FROM public.editorial_articles
  WHERE slug = 'compositions-absences-impact-analyse-match-football'
) a
CROSS JOIN LATERAL (
  VALUES
    ('UEFA technical reports', 'https://www.uefa.com/development/performance-analysis/technical-reports/', 'UEFA', 'Les rapports UEFA associent observation technique, clips, statistiques et contexte pour interpréter la performance collective.'),
    ('IFAB Laws of the Game', 'https://www.theifab.com/laws/latest/', 'IFAB', 'Les Lois du Jeu de l’IFAB constituent la référence officielle pour les règles, les sanctions et le cadre des rencontres.')
) AS s(title, url, publisher, excerpt)
ON CONFLICT (article_id, url) DO NOTHING;
