import { cn } from "@/lib/utils";
import { ScoreCard } from "@/components/ScorePrimitives";

export type Market = {
  label: string;
  pick: string;
  probability?: number;
  confidence: number;
  risk: "bas" | "moyen" | "eleve" | "élevé";
  odd?: string;
  rationale?: string;
};

const RISK_STYLE: Record<string, string> = {
  bas: "bg-brand/10 text-brand ring-brand/20",
  moyen: "bg-warn/15 text-amber-700 ring-warn/20",
  eleve: "bg-alert/10 text-alert ring-alert/20",
  élevé: "bg-alert/10 text-alert ring-alert/20",
};

export function MarketCard({ market }: { market: Market }) {
  const hasProbability = Number.isFinite(market.probability);
  const primaryMetric = hasProbability ? Math.round(market.probability!) : market.confidence;

  return (
    <ScoreCard className="flex h-full flex-col p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {market.label}
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1",
            RISK_STYLE[market.risk] ?? RISK_STYLE.moyen,
          )}
        >
          {market.risk}
        </span>
      </div>
      <div className="mt-2 text-sm font-black leading-tight text-foreground">{market.pick}</div>
      {market.rationale && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {market.rationale}
        </p>
      )}
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            {hasProbability ? "Probabilité" : "Confiance"}
          </div>
          <div className="text-xl font-black tabular-nums leading-none">{primaryMetric}%</div>
        </div>
        {hasProbability ? (
          <div className="text-right">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              Confiance données
            </div>
            <div className="text-sm font-black tabular-nums text-foreground">
              {market.confidence}%
            </div>
          </div>
        ) : market.odd ? (
          <div className="text-right">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              Cote indic.
            </div>
            <div className="font-mono text-sm font-bold text-data">{market.odd}</div>
          </div>
        ) : null}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface">
        <div
          className="animate-grow-bar h-full rounded-full bg-brand"
          style={{ width: `${primaryMetric}%` }}
          role="progressbar"
          aria-label={hasProbability ? "Probabilité estimée" : "Niveau de confiance"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={primaryMetric}
        />
      </div>
    </ScoreCard>
  );
}
