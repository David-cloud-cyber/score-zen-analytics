import { cn } from "@/lib/utils";

export function StatBar({
  label, home, away, unit = "", accent,
}: { label: string; home: number; away: number; unit?: string; accent?: boolean }) {
  const total = home + away || 1;
  const hp = (home / total) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
        <span className="tabular-nums text-foreground">{home}{unit}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">{away}{unit}</span>
      </div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-surface">
        <div
          className={cn("animate-grow-bar h-full rounded-full", accent ? "bg-brand" : "bg-foreground")}
          style={{ width: `${hp}%` }}
        />
        <div
          className="animate-grow-bar h-full flex-1 rounded-full bg-muted-foreground/40"
          style={{ animationDelay: "0.1s" }}
        />
      </div>
    </div>
  );
}
