import { useState } from "react";
import type { Formation } from "@/data/players";
import { HEATMAPS } from "@/data/players";
import { cn } from "@/lib/utils";

/**
 * Full-pitch 2D SVG. Accessible: role="img" with textual summary, and a
 * hidden keyboard-navigable list of players so screen-reader / keyboard
 * users can select a player exactly like on the pitch.
 */
export function PitchFormation({
  home, away, homeColor, awayColor,
}: { home: Formation; away: Formation; homeColor: string; awayColor: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const heatmap = selected ? HEATMAPS[selected] : null;

  const summary = `Terrain de football avec ${home.players.length} joueurs domicile en formation ${home.formation}, entraînés par ${home.coach}, et ${away.players.length} joueurs extérieurs en formation ${away.formation}, entraînés par ${away.coach}. Sélectionnez un joueur pour afficher sa zone d'activité.`;

  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-black/5">
      <svg
        viewBox="0 0 100 150"
        className="block h-auto w-full"
        role="img"
        aria-label={summary}
      >
        <title>Terrain 2D — compositions et heatmaps</title>
        <desc>{summary}</desc>
        <defs>
          <pattern id="grass" width="100" height="15" patternUnits="userSpaceOnUse">
            <rect width="100" height="15" fill="#1a7a3f" />
            <rect y="0" width="100" height="7.5" fill="#1e8547" opacity="0.6" />
          </pattern>
          <radialGradient id="heat" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcc00" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#ff6600" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#cc0000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="150" fill="url(#grass)" />
        <g fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="0.3" aria-hidden>
          <rect x="2" y="2" width="96" height="146" />
          <line x1="2" y1="75" x2="98" y2="75" />
          <circle cx="50" cy="75" r="9" />
          <circle cx="50" cy="75" r="0.5" fill="white" />
          <rect x="20" y="2" width="60" height="18" />
          <rect x="35" y="2" width="30" height="8" />
          <rect x="20" y="130" width="60" height="18" />
          <rect x="35" y="140" width="30" height="8" />
          <circle cx="50" cy="12" r="0.5" fill="white" />
          <circle cx="50" cy="138" r="0.5" fill="white" />
        </g>
        {heatmap &&
          heatmap.map((h, i) => (
            <circle
              key={i}
              cx={h.x}
              cy={150 - (h.y * 1.5)}
              r={9 * h.w}
              fill="url(#heat)"
              style={{ mixBlendMode: "screen" }}
              aria-hidden
            />
          ))}
        {away.players.map((p, i) => (
          <PlayerDot
            key={`a-${i}`}
            x={p.x}
            y={150 - p.y * 1.5}
            number={p.number}
            name={p.name}
            position={p.position}
            teamLabel={`${away.formation} extérieur`}
            color={awayColor}
            active={selected === p.name}
            onSelect={() => setSelected(selected === p.name ? null : p.name)}
          />
        ))}
        {home.players.map((p, i) => (
          <PlayerDot
            key={`h-${i}`}
            x={p.x}
            y={150 - p.y * 1.5}
            number={p.number}
            name={p.name}
            position={p.position}
            teamLabel={`${home.formation} domicile`}
            color={homeColor}
            active={selected === p.name}
            onSelect={() => setSelected(selected === p.name ? null : p.name)}
          />
        ))}
      </svg>

      <div className="flex items-center justify-between border-t border-border/60 bg-card px-4 py-2 text-[10px]">
        <span className="font-semibold text-muted-foreground">
          Touchez un joueur pour voir sa heatmap
        </span>
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-foreground ring-1 ring-black/5"
            aria-label={`Effacer la heatmap de ${selected}`}
          >
            {selected} · effacer
          </button>
        )}
      </div>

      {/* Keyboard/screen-reader accessible equivalent */}
      <div className="sr-only">
        <h4>Joueurs sélectionnables</h4>
        <ul>
          {[...home.players, ...away.players].map((p) => (
            <li key={`sr-${p.name}`}>
              <button
                onClick={() => setSelected(selected === p.name ? null : p.name)}
                aria-pressed={selected === p.name}
              >
                Numéro {p.number}, {p.name}, {p.position}
                {selected === p.name && " — heatmap affichée"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PlayerDot({
  x, y, number, name, position, teamLabel, color, active, onSelect,
}: { x: number; y: number; number: number; name: string; position: string; teamLabel: string; color: string; active: boolean; onSelect: () => void }) {
  const label = `${teamLabel}, numéro ${number}, ${name}, ${position}${active ? ", sélectionné" : ""}`;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={active}
      className="cursor-pointer focus:outline-none"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <circle
        cx={x}
        cy={y}
        r={active ? 4.2 : 3.4}
        fill={color}
        stroke="white"
        strokeWidth={active ? 0.6 : 0.4}
        className={cn(active && "animate-pulse-dot")}
      />
      <text x={x} y={y + 1.1} textAnchor="middle" fontSize="3" fill="white" fontWeight="900" aria-hidden>
        {number}
      </text>
      <text
        x={x}
        y={y + 6.5}
        textAnchor="middle"
        fontSize="2.3"
        fill="white"
        fontWeight="700"
        opacity="0.95"
        style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 0.4 }}
        aria-hidden
      >
        {name.split(" ").slice(-1)[0]}
      </text>
    </g>
  );
}
