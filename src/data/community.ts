export type Reaction = "fire" | "clap" | "brain" | "heart";

export type Comment = {
  id: string;
  author: string;
  handle: string;
  avatarColor: string;
  timeAgo: string;
  text: string;
  reactions: Record<Reaction, number>;
  replies: number;
  badge?: "top" | "expert" | "premium";
  prediction?: string;
};

export type Thread = {
  id: string;
  scope: "match" | "competition";
  scopeId: string;
  title: string;
  subtitle: string;
  color: string;
  activeUsers: number;
  comments: Comment[];
};

export const THREADS: Thread[] = [
  {
    id: "th-rma-fcb",
    scope: "match",
    scopeId: "rma-fcb",
    title: "El Clásico — Real Madrid vs FC Barcelone",
    subtitle: "Live · 72e minute · 2-1",
    color: "#FEBE10",
    activeUsers: 1284,
    comments: [
      {
        id: "c1",
        author: "Sofia Martinez",
        handle: "sofia.m",
        avatarColor: "#EE8707",
        timeAgo: "Il y a 2 min",
        text: "Bellingham est intouchable ce soir, coup franc splendide. Le Real contrôle mais Barça peut égaliser sur transition.",
        reactions: { fire: 42, clap: 18, brain: 9, heart: 6 },
        replies: 7,
        badge: "top",
        prediction: "Victoire Real 3-1",
      },
      {
        id: "c2",
        author: "Luca Bianchi",
        handle: "lucab",
        avatarColor: "#A50044",
        timeAgo: "Il y a 4 min",
        text: "Yamal est encore hors du match. Xavi doit le remettre au centre du terrain, il perd tout sur l'aile.",
        reactions: { fire: 12, clap: 5, brain: 21, heart: 2 },
        replies: 12,
        badge: "expert",
      },
      {
        id: "c3",
        author: "Yanis Bouzid",
        handle: "y.bouzid",
        avatarColor: "#008FD7",
        timeAgo: "Il y a 8 min",
        text: "L'IA me donnait 48% pour le Real, la stat était fiable — 8 tirs cadrés à la 72e, ça se ressent !",
        reactions: { fire: 8, clap: 24, brain: 15, heart: 3 },
        replies: 3,
        prediction: "Score final 3-2",
      },
      {
        id: "c4",
        author: "Emma Vidal",
        handle: "emma.v",
        avatarColor: "#3B82F6",
        timeAgo: "Il y a 12 min",
        text: "On sous-estime Endrick, la meilleure entrée du match. Il faut le titulariser en Ligue des Champions.",
        reactions: { fire: 31, clap: 14, brain: 4, heart: 11 },
        replies: 5,
        badge: "premium",
      },
    ],
  },
  {
    id: "th-psg-om",
    scope: "match",
    scopeId: "psg-om",
    title: "PSG vs Olympique de Marseille",
    subtitle: "Live · 72e minute · 2-1",
    color: "#004170",
    activeUsers: 892,
    comments: [
      {
        id: "c5",
        author: "Kevin Reynaud",
        handle: "krey",
        avatarColor: "#004170",
        timeAgo: "Il y a 3 min",
        text: "Dembélé est en feu, il transforme le PSG à lui seul. Enfin un attaquant qui joue collectif.",
        reactions: { fire: 55, clap: 20, brain: 6, heart: 8 },
        replies: 9,
        badge: "top",
      },
      {
        id: "c6",
        author: "Fatou Diallo",
        handle: "fatou_d",
        avatarColor: "#2FAEE0",
        timeAgo: "Il y a 7 min",
        text: "Aubameyang tient l'attaque de l'OM à bout de bras. Il mérite mieux comme milieu.",
        reactions: { fire: 22, clap: 12, brain: 9, heart: 4 },
        replies: 6,
      },
    ],
  },
  {
    id: "th-ucl",
    scope: "competition",
    scopeId: "ucl",
    title: "Ligue des Champions — 5e journée",
    subtitle: "Discussion générale · 3 470 membres",
    color: "#001489",
    activeUsers: 2140,
    comments: [
      {
        id: "c7",
        author: "Marco Silva",
        handle: "marco.s",
        avatarColor: "#001489",
        timeAgo: "Il y a 15 min",
        text: "Les affiches de demain sont énormes. Atlético-Porto peut basculer sur un détail — les Espagnols ont beaucoup à jouer.",
        reactions: { fire: 34, clap: 19, brain: 12, heart: 5 },
        replies: 11,
        badge: "expert",
        prediction: "Atlético 2-1 Porto",
      },
      {
        id: "c8",
        author: "Ines Kowalski",
        handle: "ines.k",
        avatarColor: "#10b981",
        timeAgo: "Il y a 22 min",
        text: "Mon top 3 pour la qualification : Real, City, Bayern. Le PSG a le plus dur calendrier restant.",
        reactions: { fire: 18, clap: 27, brain: 33, heart: 6 },
        replies: 24,
        badge: "top",
      },
    ],
  },
  {
    id: "th-l1",
    scope: "competition",
    scopeId: "l1",
    title: "Ligue 1 — Multiplex du soir",
    subtitle: "Discussion générale · 1 820 membres",
    color: "#091C3E",
    activeUsers: 640,
    comments: [
      {
        id: "c9",
        author: "Julien Perez",
        handle: "juju.p",
        avatarColor: "#DA020E",
        timeAgo: "Il y a 6 min",
        text: "Lille joue toujours aussi bien mais Lyon commence à trouver son équilibre. Belle bataille pour l'Europe.",
        reactions: { fire: 15, clap: 8, brain: 14, heart: 3 },
        replies: 4,
      },
      {
        id: "c10",
        author: "Sarah Nguyen",
        handle: "sarah.n",
        avatarColor: "#FEDB00",
        timeAgo: "Il y a 18 min",
        text: "Lens est sous-coté. Ils ont le meilleur bloc défensif du top 6, ça va payer sur la durée.",
        reactions: { fire: 24, clap: 11, brain: 19, heart: 4 },
        replies: 8,
        badge: "premium",
      },
    ],
  },
];

export type CreditTx = {
  id: string;
  date: string;
  label: string;
  detail: string;
  amount: number; // negative = spent, positive = credited
  type: "analysis" | "topup" | "bonus" | "refund";
};

export const CREDIT_HISTORY: CreditTx[] = [
  { id: "t1", date: "Aujourd'hui · 14:32", label: "Analyse IA", detail: "Real Madrid vs FC Barcelone", amount: -3, type: "analysis" },
  { id: "t2", date: "Aujourd'hui · 09:12", label: "Analyse IA", detail: "PSG vs Marseille", amount: -3, type: "analysis" },
  { id: "t3", date: "Hier · 22:04", label: "Analyse IA", detail: "Man City vs Liverpool", amount: -3, type: "analysis" },
  { id: "t4", date: "Hier · 08:00", label: "Recharge", detail: "Pack 50 crédits", amount: +50, type: "topup" },
  { id: "t5", date: "Hier · 07:59", label: "Bonus quotidien", detail: "Connexion 5 jours", amount: +5, type: "bonus" },
  { id: "t6", date: "Il y a 2 jours", label: "Analyse IA", detail: "Bayern vs Dortmund", amount: -3, type: "analysis" },
  { id: "t7", date: "Il y a 3 jours", label: "Remboursement", detail: "Erreur modèle IA", amount: +3, type: "refund" },
  { id: "t8", date: "Il y a 4 jours", label: "Recharge", detail: "Pack 100 crédits", amount: +100, type: "topup" },
];

export const CREDIT_PACKS = [
  { id: "p1", credits: 20, price: "1,99 €", perAnalysis: "0,30 €/analyse", best: false },
  { id: "p2", credits: 50, price: "3,99 €", perAnalysis: "0,24 €/analyse", best: true },
  { id: "p3", credits: 150, price: "9,99 €", perAnalysis: "0,20 €/analyse", best: false },
  { id: "p4", credits: 500, price: "24,99 €", perAnalysis: "0,15 €/analyse", best: false },
];

export const CREDIT_RULES = [
  { cost: 3, label: "Analyse IA d'un match", desc: "Probabilités 1X2, score probable et marchés recommandés" },
  { cost: 5, label: "Comparateur personnalisé", desc: "Analyse de deux équipes de votre choix avec chat IA" },
  { cost: 2, label: "Insights compositions", desc: "Heatmaps joueurs et suggestions tactiques" },
  { cost: 0, label: "Livescore & statistiques", desc: "Toujours gratuit — mises à jour temps réel" },
];
