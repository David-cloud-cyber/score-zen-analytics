export type Team = {
  id: string;
  name: string;
  short: string;
  initials: string;
  color: string; // hex
  country: string;
};

export const TEAMS: Team[] = [
  { id: "rma", name: "Real Madrid", short: "R. Madrid", initials: "RMA", color: "#FEBE10", country: "Espagne" },
  { id: "fcb", name: "FC Barcelone", short: "Barcelone", initials: "FCB", color: "#A50044", country: "Espagne" },
  { id: "atm", name: "Atlético Madrid", short: "Atlético", initials: "ATM", color: "#CE3524", country: "Espagne" },
  { id: "psg", name: "Paris Saint-Germain", short: "PSG", initials: "PSG", color: "#004170", country: "France" },
  { id: "om", name: "Olympique de Marseille", short: "OM", initials: "OM", color: "#2FAEE0", country: "France" },
  { id: "ol", name: "Olympique Lyonnais", short: "Lyon", initials: "OL", color: "#0E4C92", country: "France" },
  { id: "asm", name: "AS Monaco", short: "Monaco", initials: "ASM", color: "#CE1126", country: "France" },
  { id: "sre", name: "Stade Rennais FC", short: "Rennes", initials: "SRFC", color: "#E4032E", country: "France" },
  { id: "rcl", name: "RC Lens", short: "Lens", initials: "RCL", color: "#FEDB00", country: "France" },
  { id: "losc", name: "Lille OSC", short: "Lille", initials: "LOSC", color: "#DA020E", country: "France" },
  { id: "mci", name: "Manchester City", short: "Man City", initials: "MCI", color: "#6CABDD", country: "Angleterre" },
  { id: "mun", name: "Manchester United", short: "Man United", initials: "MUN", color: "#DA291C", country: "Angleterre" },
  { id: "liv", name: "Liverpool", short: "Liverpool", initials: "LIV", color: "#C8102E", country: "Angleterre" },
  { id: "ars", name: "Arsenal", short: "Arsenal", initials: "ARS", color: "#EF0107", country: "Angleterre" },
  { id: "che", name: "Chelsea", short: "Chelsea", initials: "CHE", color: "#034694", country: "Angleterre" },
  { id: "tot", name: "Tottenham", short: "Spurs", initials: "TOT", color: "#132257", country: "Angleterre" },
  { id: "juv", name: "Juventus", short: "Juventus", initials: "JUV", color: "#000000", country: "Italie" },
  { id: "int", name: "Inter Milan", short: "Inter", initials: "INT", color: "#0068A8", country: "Italie" },
  { id: "mil", name: "AC Milan", short: "Milan", initials: "MIL", color: "#FB090B", country: "Italie" },
  { id: "nap", name: "Napoli", short: "Napoli", initials: "NAP", color: "#12A0D7", country: "Italie" },
  { id: "bay", name: "Bayern Munich", short: "Bayern", initials: "BAY", color: "#DC052D", country: "Allemagne" },
  { id: "bvb", name: "Borussia Dortmund", short: "Dortmund", initials: "BVB", color: "#FDE100", country: "Allemagne" },
  { id: "lev", name: "Bayer Leverkusen", short: "Leverkusen", initials: "LEV", color: "#E32221", country: "Allemagne" },
  { id: "por", name: "FC Porto", short: "Porto", initials: "POR", color: "#00428C", country: "Portugal" },
  { id: "ben", name: "Benfica", short: "Benfica", initials: "SLB", color: "#E30613", country: "Portugal" },
  { id: "ajx", name: "Ajax", short: "Ajax", initials: "AJX", color: "#D2122E", country: "Pays-Bas" },
  { id: "psv", name: "PSV Eindhoven", short: "PSV", initials: "PSV", color: "#ED1C24", country: "Pays-Bas" },
  { id: "gal", name: "Galatasaray", short: "Galatasaray", initials: "GAL", color: "#A90432", country: "Turquie" },
  { id: "cel", name: "Celtic", short: "Celtic", initials: "CEL", color: "#008E4F", country: "Écosse" },
  { id: "rbl", name: "RB Leipzig", short: "Leipzig", initials: "RBL", color: "#DD0741", country: "Allemagne" },
];

export function team(id: string): Team {
  const t = TEAMS.find((t) => t.id === id);
  if (!t) throw new Error(`Unknown team: ${id}`);
  return t;
}
