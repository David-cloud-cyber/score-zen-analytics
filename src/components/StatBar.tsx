import { cn } from "@/lib/utils";

export function StatBar({
  label,
  home,
  away,
  unit = "",
  accent,
  homeName,
  awayName,
}: {
  label: string;
  home: number | null;
  away: number | null;
  unit?: string;
  accent?: boolean;
  homeName?: string;
  awayName?: string;
}) {
  const complete = home !== null && away !== null;
  const homeValue = home ?? 0;
  const awayValue = away ?? 0;
  const total = homeValue + awayValue || 1;
  const hp = (homeValue / total) * 100;
  const description = complete
    ? `${label} : ${homeName ?? "domicile"} ${home}${unit}, ${awayName ?? "extérieur"} ${away}${unit}.`
    : `${label} : donnée non disponible pour les deux équipes.`;
  return (
    <div className="space-y-1.5" role="group" aria-label={description}>
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
        <span className="tabular-nums text-foreground" aria-hidden>
          {complete ? `${home}${unit}` : "—"}
        </span>
        <span className="text-muted-foreground" aria-hidden>
          {label}
        </span>
        <span className="tabular-nums text-foreground" aria-hidden>
          {complete ? `${away}${unit}` : "—"}
        </span>
      </div>
      {complete ? (
        <div
          className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-surface"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={homeValue}
          aria-label={description}
        >
          <div
            className={cn(
              "animate-grow-bar h-full rounded-full",
              accent ? "bg-brand" : "bg-foreground",
            )}
            style={{ width: `${hp}%` }}
            aria-hidden
          />
          <div
            className="animate-grow-bar h-full flex-1 rounded-full bg-muted-foreground/40"
            style={{ animationDelay: "0.1s" }}
            aria-hidden
          />
        </div>
      ) : (
        <div className="h-1.5 rounded-full bg-surface" aria-label={description} />
      )}
      <span className="sr-only">{description}</span>
    </div>
  );
}
