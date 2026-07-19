export type Competition = {
  id: string;
  name: string;
  short: string;
  country: string;
  color: string;
};

export const COMPETITIONS: Competition[] = [
  { id: "l1", name: "Ligue 1 McDonald's", short: "Ligue 1", country: "France", color: "#091C3E" },
  { id: "pl", name: "Premier League", short: "Premier League", country: "Angleterre", color: "#3D195B" },
  { id: "liga", name: "LaLiga EA Sports", short: "LaLiga", country: "Espagne", color: "#EE8707" },
  { id: "sa", name: "Serie A Enilive", short: "Serie A", country: "Italie", color: "#008FD7" },
  { id: "bl", name: "Bundesliga", short: "Bundesliga", country: "Allemagne", color: "#D3010C" },
  { id: "ucl", name: "UEFA Champions League", short: "Ligue des Champions", country: "Europe", color: "#001489" },
  { id: "uel", name: "UEFA Europa League", short: "Europa League", country: "Europe", color: "#F58220" },
];

export function competition(id: string): Competition {
  const c = COMPETITIONS.find((c) => c.id === id);
  if (!c) throw new Error(`Unknown competition: ${id}`);
  return c;
}
