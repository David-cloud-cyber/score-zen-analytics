export function WinProbabilityDonut({
  home, draw, away, size = 160,
}: { home: number; draw: number; away: number; size?: number }) {
  const total = home + draw + away;
  const homePct = (home / total) * 100;
  const drawPct = (draw / total) * 100;
  // conic-gradient: home brand, draw muted, away accent
  const bg = `conic-gradient(var(--brand) 0% ${homePct}%, oklch(0.85 0.01 260) ${homePct}% ${homePct + drawPct}%, var(--data) ${homePct + drawPct}% 100%)`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="animate-rise size-full rounded-full" style={{ background: bg }} />
      <div className="absolute inset-[14%] grid place-items-center rounded-full bg-background">
        <div className="text-center">
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Domicile</div>
          <div className="text-3xl font-black tabular-nums leading-none">{home}%</div>
          <div className="mt-1 text-[9px] font-semibold text-muted-foreground">Confiance IA</div>
        </div>
      </div>
    </div>
  );
}

export function WinProbabilityLegend({ home, draw, away, homeName, awayName }: { home: number; draw: number; away: number; homeName: string; awayName: string }) {
  return (
    <div className="space-y-2 text-xs">
      <Row color="var(--brand)" label={homeName} value={home} />
      <Row color="oklch(0.85 0.01 260)" label="Match nul" value={draw} />
      <Row color="var(--data)" label={awayName} value={away} />
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      <span className="flex-1 truncate text-muted-foreground">{label}</span>
      <span className="font-black tabular-nums">{value}%</span>
    </div>
  );
}
