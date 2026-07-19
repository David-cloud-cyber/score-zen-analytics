import { useState } from "react";
import type { Formation } from "@/data/players";
import { HEATMAPS } from "@/data/players";
import { cn } from "@/lib/utils";

/**
 * Full-pitch 2D SVG. Home occupies bottom half (y 55-95), away top half (y 5-45).
 * Formations are stored with home y 5-45 and away y 55-95; we invert.
 */
export function PitchFormation({
  home, away, homeColor, awayColor,
}: { home: Formation; away: Formation; homeColor: string; awayColor: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const heatmap = selected ? HEATMAPS[selected] : null;
  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-black/5">
      <svg viewBox="0 0 100 150" className="block h-auto w-full">
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
        {/* Lines */}
        <g fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="0.3">
          <rect x="2" y="2" width="96" height="146" />
          <line x1="2" y1="75" x2="98" y2="75" />
          <circle cx="50" cy="75" r="9" />
          <circle cx="50" cy="75" r="0.5" fill="white" />
          {/* Boxes */}
          <rect x="20" y="2" width="60" height="18" />
          <rect x="35" y="2" width="30" height="8" />
          <rect x="20" y="130" width="60" height="18" />
          <rect x="35" y="140" width="30" height="8" />
          <circle cx="50" cy="12" r="0.5" fill="white" />
          <circle cx="50" cy="138" r="0.5" fill="white" />
        </g>
        {/* Heatmap overlay (home side by convention) */}
        {heatmap &&
          heatmap.map((h, i) => (
            <circle
              key={i}
              cx={h.x}
              cy={150 - (h.y * 1.5)}
              r={9 * h.w}
              fill="url(#heat)"
              style={{ mixBlendMode: "screen" }}
            />
          ))}
        {/* Away players (top half) */}
        {away.players.map((p, i) => (
          <PlayerDot
            key={`a-${i}`}
            x={p.x}
            y={150 - p.y * 1.5}
            number={p.number}
            name={p.name}
            color={awayColor}
            active={selected === p.name}
            onClick={() => setSelected(selected === p.name ? null : p.name)}
          />
        ))}
        {/* Home players (bottom half) */}
        {home.players.map((p, i) => (
          <PlayerDot
            key={`h-${i}`}
            x={p.x}
            y={150 - p.y * 1.5}
            number={p.number}
            name={p.name}
            color={homeColor}
            active={selected === p.name}
            onClick={() => setSelected(selected === p.name ? null : p.name)}
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
          >
            {selected} · effacer
          </button>
        )}
      </div>
    </div>
  );
}

function PlayerDot({
  x, y, number, name, color, active, onClick,
}: { x: number; y: number; number: number; name: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <g className="cursor-pointer" onClick={onClick}>
      <circle cx={x} cy={y} r={active ? 4.2 : 3.4} fill={color} stroke="white" strokeWidth="0.4" className={cn(active && "animate-pulse-dot")} />
      <text x={x} y={y + 1.1} textAnchor="middle" fontSize="3" fill="white" fontWeight="900">
        {number}
      </text>
      <text x={x} y={y + 6.5} textAnchor="middle" fontSize="2.3" fill="white" fontWeight="700" opacity="0.95" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 0.4 }}>
        {name.split(" ").slice(-1)[0]}
      </text>
    </g>
  );
}
