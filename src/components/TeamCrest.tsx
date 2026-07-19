import { cn } from "@/lib/utils";
import type { Team } from "@/data/teams";

export function TeamCrest({ team, size = 40, className }: { team: Team; size?: number; className?: string }) {
  const initials = team.initials.slice(0, 3);
  return (
    <div
      className={cn("shrink-0 grid place-items-center rounded-full font-bold text-white select-none ring-1 ring-black/10", className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${team.color} 0%, ${shade(team.color, -18)} 100%)`,
        fontSize: size * 0.32,
        letterSpacing: -0.5,
        color: readableOn(team.color),
      }}
      aria-label={team.name}
    >
      {initials}
    </div>
  );
}

function shade(hex: string, percent: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `#${((R << 16) | (G << 8) | B).toString(16).padStart(6, "0")}`;
}

function readableOn(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq > 175 ? "#0a0a0a" : "#ffffff";
}
