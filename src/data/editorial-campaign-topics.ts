import type { EditorialCategory } from "@/lib/editorial.types";

export type EditorialCampaignTopic = {
  key: string;
  title: string;
  category: EditorialCategory;
  queryTerms: string[];
  trendScore: number;
};

type Subject = { key: string; label: string; queryTerms: string[] };
type Angle = { label: string; category: EditorialCategory; queryTerms: string[] };

const competitionSubjects: Subject[] = [
  { key: "premier-league-2026-2027", label: "Premier League 2026-2027", queryTerms: ["premier league", "angleterre"] },
  { key: "ligue-1-2026-2027", label: "Ligue 1 2026-2027", queryTerms: ["ligue 1", "france"] },
  { key: "liga-2026-2027", label: "Liga 2026-2027", queryTerms: ["liga", "espagne"] },
  { key: "serie-a-2026-2027", label: "Serie A 2026-2027", queryTerms: ["serie a", "italie"] },
  { key: "bundesliga-2026-2027", label: "Bundesliga 2026-2027", queryTerms: ["bundesliga", "allemagne"] },
  { key: "champions-league-2026-2027", label: "Ligue des champions 2026-2027", queryTerms: ["champions league", "uefa"] },
  { key: "europa-league-2026-2027", label: "Ligue Europa 2026-2027", queryTerms: ["europa league", "uefa"] },
  { key: "conference-league-2026-2027", label: "Ligue Conference 2026-2027", queryTerms: ["conference league", "uefa"] },
  { key: "mondial-2026", label: "Mondial 2026", queryTerms: ["mondial 2026", "coupe du monde"] },
  { key: "qualifications-mondial-2026", label: "Qualifications du Mondial 2026", queryTerms: ["qualifications", "mondial"] },
  { key: "football-africain-2026", label: "Football africain en 2026", queryTerms: ["football africain", "caf"] },
  { key: "ligue-champions-caf-2026", label: "Ligue des champions CAF 2026", queryTerms: ["ligue des champions caf", "caf"] },
  { key: "coupe-confederation-caf-2026", label: "Coupe de la Confédération CAF 2026", queryTerms: ["confédération caf", "caf"] },
  { key: "elite-one-cameroun-2026", label: "Elite One du Cameroun 2026", queryTerms: ["elite one", "cameroun"] },
  { key: "ligue-1-cote-ivoire-2026", label: "Ligue 1 de Côte d’Ivoire 2026", queryTerms: ["ligue 1 côte d’ivoire", "côte d’ivoire"] },
  { key: "ligue-1-senegal-2026", label: "Ligue 1 du Sénégal 2026", queryTerms: ["ligue 1 sénégal", "sénégal"] },
  { key: "liga-portugal-2026-2027", label: "Liga Portugal 2026-2027", queryTerms: ["liga portugal", "portugal"] },
  { key: "saudi-pro-league-2026-2027", label: "Saudi Pro League 2026-2027", queryTerms: ["saudi pro league", "arabie saoudite"] },
  { key: "mls-2026", label: "MLS 2026", queryTerms: ["mls", "états-unis"] },
  { key: "football-feminin-2026", label: "Football féminin en 2026", queryTerms: ["football féminin", "uefa"] },
];

const competitionAngles: Angle[] = [
  { label: "calendrier, affiches et repères utiles", category: "competitions", queryTerms: ["calendrier", "affiches"] },
  { label: "classement et course aux premières places", category: "analyse", queryTerms: ["classement", "points"] },
  { label: "équipes à suivre et enjeux de la saison", category: "competitions", queryTerms: ["équipes", "enjeux"] },
  { label: "forme, absences et compositions à surveiller", category: "forme", queryTerms: ["forme", "blessures", "composition"] },
  { label: "méthode pour analyser les matchs", category: "guides", queryTerms: ["analyser", "match"] },
];

const teamSubjects: Subject[] = [
  { key: "paris-saint-germain", label: "Paris Saint-Germain", queryTerms: ["psg", "paris saint-germain"] },
  { key: "olympique-marseille", label: "Olympique de Marseille", queryTerms: ["om", "marseille"] },
  { key: "olympique-lyonnais", label: "Olympique Lyonnais", queryTerms: ["lyon", "ol"] },
  { key: "arsenal", label: "Arsenal", queryTerms: ["arsenal", "premier league"] },
  { key: "liverpool", label: "Liverpool", queryTerms: ["liverpool", "premier league"] },
  { key: "chelsea", label: "Chelsea", queryTerms: ["chelsea", "premier league"] },
  { key: "manchester-city", label: "Manchester City", queryTerms: ["manchester city", "premier league"] },
  { key: "manchester-united", label: "Manchester United", queryTerms: ["manchester united", "premier league"] },
  { key: "real-madrid", label: "Real Madrid", queryTerms: ["real madrid", "liga"] },
  { key: "fc-barcelone", label: "FC Barcelone", queryTerms: ["barcelone", "liga"] },
  { key: "bayern-munich", label: "Bayern Munich", queryTerms: ["bayern", "bundesliga"] },
  { key: "borussia-dortmund", label: "Borussia Dortmund", queryTerms: ["dortmund", "bundesliga"] },
  { key: "inter-milan", label: "Inter Milan", queryTerms: ["inter", "serie a"] },
  { key: "ac-milan", label: "AC Milan", queryTerms: ["milan", "serie a"] },
  { key: "juventus", label: "Juventus", queryTerms: ["juventus", "serie a"] },
  { key: "al-ahly", label: "Al Ahly", queryTerms: ["al ahly", "egypte", "caf"] },
  { key: "wydad-casablanca", label: "Wydad Casablanca", queryTerms: ["wydad", "maroc", "caf"] },
  { key: "esperance-tunis", label: "Espérance de Tunis", queryTerms: ["espérance", "tunisie", "caf"] },
  { key: "senegal", label: "Sénégal", queryTerms: ["sénégal", "lions"] },
  { key: "cote-ivoire", label: "Côte d’Ivoire", queryTerms: ["côte d’ivoire", "éléphants"] },
];

const teamAngles: Angle[] = [
  { label: "calendrier, prochains matchs et résultats", category: "actualites", queryTerms: ["prochain match", "résultat"] },
  { label: "forme récente et statistiques à suivre", category: "analyse", queryTerms: ["forme", "statistiques"] },
  { label: "compositions, absences et joueurs clés", category: "forme", queryTerms: ["composition", "absence", "joueurs"] },
  { label: "objectifs de la saison et enjeux sportifs", category: "competitions", queryTerms: ["objectifs", "saison"] },
  { label: "méthode pour lire ses matchs avec les données", category: "guides", queryTerms: ["données", "analyser"] },
];

function buildTopics(subjects: Subject[], angles: Angle[], baseScore: number) {
  return subjects.flatMap((subject, subjectIndex) =>
    angles.map((angle, angleIndex) => ({
      key: `${subject.key}-${angleIndex + 1}`,
      title: `${subject.label} : ${angle.label}`,
      category: angle.category,
      queryTerms: [...subject.queryTerms, ...angle.queryTerms],
      trendScore: baseScore - subjectIndex - angleIndex,
    })),
  );
}

/**
 * File de 200 sujets distincts. Ce sont des briefs, pas des pages publiées :
 * le pipeline doit encore trouver deux sources récentes et faire valider le
 * contenu avant de le rendre public.
 */
export const EDITORIAL_CAMPAIGN_TOPICS: EditorialCampaignTopic[] = [
  ...buildTopics(competitionSubjects, competitionAngles, 96),
  ...buildTopics(teamSubjects, teamAngles, 86),
];

