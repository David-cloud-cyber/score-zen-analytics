import { cn } from "@/lib/utils";

export function StatBar({
  label, home, away, unit = "", accent, homeName, awayName,
}: { label: string; home: number; away: number; unit?: string; accent?: boolean; homeName?: string; awayName?: string }) {
  const total = home + away || 1;
  const hp = (home / total) * 100;
  const description = `${label} : ${homeName ?? "domicile"} ${home}${unit}, ${awayName ?? "extérieur"} ${away}${unit}.`;
  return (
    <div
      className="space-y-1.5"
      role="group"
      aria-label={description}
    >
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
        <span className="tabular-nums text-foreground" aria-hidden>{home}{unit}</span>
        <span className="text-muted-foreground" aria-hidden>{label}</span>
        <span className="tabular-nums text-foreground" aria-hidden>{away}{unit}</span>
      </div>
      <div
        className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-surface"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={home}
        aria-label={description}
      >
        <div
          className={cn("animate-grow-bar h-full rounded-full", accent ? "bg-brand" : "bg-foreground")}
          style={{ width: `${hp}%` }}
          aria-hidden
        />
        <div
          className="animate-grow-bar h-full flex-1 rounded-full bg-muted-foreground/40"
          style={{ animationDelay: "0.1s" }}
          aria-hidden
        />
      </div>
      <span className="sr-only">{description}</span>
    </div>
  );
}
