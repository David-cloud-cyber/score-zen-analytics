export type Risk = "bas" | "moyen" | "élevé";

export type Market = {
  label: string;
  pick: string;
  confidence: number; // 0-100
  risk: Risk;
  odd: string;
};

export type Analysis = {
  matchId: string;
  probabilities: { home: number; draw: number; away: number };
  probableScore: string;
  altScores: string[];
  confidence: number;
  markets: Market[];
  keyFactors: string[];
  aiText: string;
  h2h: { date: string; home: string; away: string; score: string; competition: string }[];
  injuries: { team: "home" | "away"; player: string; reason: string }[];
};

export const ANALYSES: Record<string, Analysis> = {
  "rma-fcb": {
    matchId: "rma-fcb",
    probabilities: { home: 48, draw: 22, away: 30 },
    probableScore: "2 - 1",
    altScores: ["2-1", "3-1", "2-2", "1-1"],
    confidence: 64,
    markets: [
      { label: "1X2", pick: "Victoire Real Madrid", confidence: 62, risk: "moyen", odd: "2.10" },
      { label: "Double Chance", pick: "1X (Madrid ou nul)", confidence: 81, risk: "bas", odd: "1.35" },
      { label: "Plus/Moins", pick: "Plus de 2.5 buts", confidence: 78, risk: "bas", odd: "1.55" },
      { label: "BTTS", pick: "Les deux marquent — Oui", confidence: 72, risk: "moyen", odd: "1.62" },
      { label: "Score exact", pick: "2 - 1", confidence: 22, risk: "élevé", odd: "8.50" },
      { label: "Buteur", pick: "Vinícius Jr marque", confidence: 58, risk: "moyen", odd: "2.30" },
      { label: "Corners", pick: "Plus de 9.5", confidence: 66, risk: "moyen", odd: "1.85" },
      { label: "Cartons", pick: "Plus de 4.5", confidence: 71, risk: "moyen", odd: "1.72" },
    ],
    keyFactors: [
      "Avantage domicile marqué : Real invaincu à Bernabéu depuis 14 matchs.",
      "Forme offensive de Vinícius Jr (7 buts sur les 6 derniers matchs).",
      "Bloc bas de Barcelone en difficulté face aux transitions rapides.",
      "Absence de Koundé côté droit visiteur — brèche exploitable.",
      "Historique récent : 3 victoires Real sur les 5 derniers Clásicos.",
    ],
    aiText:
      "Le Real Madrid part favori dans un Clásico qui promet du spectacle. Les transitions rapides emmenées par Vinícius Jr et Bellingham devraient exploiter les fragilités défensives d'un Barça amoindri par l'absence de Koundé. Attendez-vous à un match ouvert avec des occasions des deux côtés — les données pointent vers un scénario à trois buts ou plus (78% de confiance). Le marché 'Double Chance 1X' offre le meilleur rapport risque/rendement. Attention néanmoins au potentiel offensif catalan : Lewandowski et Yamal restent des menaces constantes.",
    h2h: [
      { date: "26 oct. 2024", home: "Real Madrid", away: "Barcelone", score: "0 - 4", competition: "LaLiga" },
      { date: "21 avr. 2024", home: "Real Madrid", away: "Barcelone", score: "3 - 2", competition: "LaLiga" },
      { date: "28 oct. 2023", home: "Barcelone", away: "Real Madrid", score: "1 - 2", competition: "LaLiga" },
      { date: "05 avr. 2023", home: "Real Madrid", away: "Barcelone", score: "0 - 4", competition: "Copa" },
      { date: "02 mars 2023", home: "Barcelone", away: "Real Madrid", score: "0 - 1", competition: "Copa" },
    ],
    injuries: [
      { team: "home", player: "Militão", reason: "Léger — apte" },
      { team: "away", player: "Koundé", reason: "Suspendu" },
      { team: "away", player: "De Jong", reason: "Cheville — incertain" },
    ],
  },
};

export function analysisFor(matchId: string): Analysis {
  return ANALYSES[matchId] ?? ANALYSES["rma-fcb"];
}

export function customAnalysis(homeName: string, awayName: string): Analysis {
  const base = ANALYSES["rma-fcb"];
  return {
    ...base,
    aiText: `L'analyse préliminaire de ${homeName} contre ${awayName} indique un match serré et disputé. Les modèles statistiques favorisent légèrement l'équipe à domicile grâce à un contexte favorable (forme récente, avantage terrain, historique). Les marchés à valeur identifiés sont "Plus de 2.5 buts" et "Double Chance". Rappelez-vous que ces projections sont indicatives et sensibles aux compositions officielles publiées environ une heure avant le coup d'envoi.`,
  };
}
