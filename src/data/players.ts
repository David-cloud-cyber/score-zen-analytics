export type Player = {
  number: number;
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  x: number; // 0-100 (left-right)
  y: number; // 0-100 (own goal 0 → opp goal 100)
};

export type Formation = {
  teamId: string;
  formation: string;
  coach: string;
  players: Player[];
};

// Home: attacks upward (y grows towards center line & beyond in own half rendering below)
// We render two half-pitches stacked; each formation is positioned on its own half (y 5-45).
export const FORMATIONS: Record<string, Formation> = {
  rma: {
    teamId: "rma",
    formation: "4-3-3",
    coach: "Carlo Ancelotti",
    players: [
      { number: 1, name: "Courtois", position: "GK", x: 50, y: 8 },
      { number: 2, name: "Carvajal", position: "DF", x: 82, y: 18 },
      { number: 3, name: "Militão", position: "DF", x: 62, y: 15 },
      { number: 4, name: "Rüdiger", position: "DF", x: 38, y: 15 },
      { number: 5, name: "Mendy", position: "DF", x: 18, y: 18 },
      { number: 8, name: "Valverde", position: "MF", x: 72, y: 30 },
      { number: 10, name: "Modrić", position: "MF", x: 50, y: 28 },
      { number: 14, name: "Camavinga", position: "MF", x: 28, y: 30 },
      { number: 7, name: "Vinícius Jr", position: "FW", x: 22, y: 42 },
      { number: 5, name: "Bellingham", position: "FW", x: 50, y: 40 },
      { number: 11, name: "Rodrygo", position: "FW", x: 78, y: 42 },
    ],
  },
  fcb: {
    teamId: "fcb",
    formation: "4-3-3",
    coach: "Hansi Flick",
    players: [
      { number: 1, name: "Ter Stegen", position: "GK", x: 50, y: 92 },
      { number: 2, name: "Koundé", position: "DF", x: 82, y: 82 },
      { number: 4, name: "Araujo", position: "DF", x: 62, y: 85 },
      { number: 15, name: "Christensen", position: "DF", x: 38, y: 85 },
      { number: 3, name: "Balde", position: "DF", x: 18, y: 82 },
      { number: 21, name: "De Jong", position: "MF", x: 50, y: 72 },
      { number: 8, name: "Pedri", position: "MF", x: 30, y: 70 },
      { number: 6, name: "Gavi", position: "MF", x: 70, y: 70 },
      { number: 27, name: "Yamal", position: "FW", x: 78, y: 58 },
      { number: 9, name: "Lewandowski", position: "FW", x: 50, y: 60 },
      { number: 11, name: "Raphinha", position: "FW", x: 22, y: 58 },
    ],
  },
};

// Realistic-ish heatmap points (x,y in %, weight 0-1)
export const HEATMAPS: Record<string, { x: number; y: number; w: number }[]> = {
  "Vinícius Jr": [
    { x: 20, y: 40, w: 1 }, { x: 25, y: 55, w: 0.7 }, { x: 15, y: 30, w: 0.9 },
    { x: 30, y: 45, w: 0.5 }, { x: 10, y: 50, w: 0.6 }, { x: 22, y: 65, w: 0.4 },
  ],
  Bellingham: [
    { x: 50, y: 45, w: 1 }, { x: 45, y: 55, w: 0.8 }, { x: 55, y: 35, w: 0.7 },
    { x: 40, y: 40, w: 0.6 }, { x: 60, y: 50, w: 0.5 },
  ],
  Lewandowski: [
    { x: 50, y: 65, w: 1 }, { x: 45, y: 75, w: 0.6 }, { x: 55, y: 60, w: 0.7 },
  ],
  Yamal: [
    { x: 80, y: 60, w: 1 }, { x: 75, y: 70, w: 0.8 }, { x: 85, y: 50, w: 0.6 },
  ],
};
