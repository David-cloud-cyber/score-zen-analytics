import { cn } from "@/lib/utils";

export type Market = {
  label: string;
  pick: string;
  confidence: number;
  risk: "bas" | "moyen" | "eleve" | "élevé";
  odd?: string;
  rationale?: string;
};

const RISK_STYLE: Record<string, string> = {
  bas: "bg-brand/10 text-brand ring-brand/20",
  moyen: "bg-warn/15 text-amber-700 ring-warn/20",
  eleve: "bg-alert/10 text-alert ring-alert/20",
  "élevé": "bg-alert/10 text-alert ring-alert/20",
};

export function MarketCard({ market }: { market: Market }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5 dark:ring-white/5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{market.label}</span>
        <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1", RISK_STYLE[market.risk] ?? RISK_STYLE.moyen)}>
          {market.risk}
        </span>
      </div>
      <div className="mt-2 text-[13px] font-bold leading-tight text-foreground">{market.pick}</div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Confiance</div>
          <div className="text-xl font-black tabular-nums leading-none">{market.confidence}%</div>
        </div>
        {market.odd && (
          <div className="text-right">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Cote indic.</div>
            <div className="font-mono text-sm font-bold text-data">{market.odd}</div>
          </div>
        )}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface">
        <div
          className="animate-grow-bar h-full rounded-full bg-foreground"
          style={{ width: `${market.confidence}%` }}
        />
      </div>
    </div>
  );
}
