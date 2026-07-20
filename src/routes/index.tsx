import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Search, ChevronRight } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { MATCHES } from "@/data/matches";
import { COMPETITIONS, competition } from "@/data/competitions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const FILTERS = [
  { id: "live", label: "En direct" },
  { id: "upcoming", label: "À venir" },
  { id: "finished", label: "Terminés" },
] as const;

function HomePage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("live");
  const filtered = MATCHES.filter((m) =>
    filter === "live" ? m.status === "live" || m.status === "ht" : m.status === filter,
  );
  const grouped = COMPETITIONS.map((c) => ({
    comp: c,
    matches: filtered.filter((m) => m.competitionId === c.id),
  })).filter((g) => g.matches.length > 0);

  return (
    <AppShell>
      <PageTitle
        eyebrow="Aujourd'hui · 5 nov."
        title="Matchs du jour"
        action={
          <button className="grid size-10 place-items-center rounded-full bg-surface ring-1 ring-black/5" aria-label="Rechercher">
            <Search className="size-4" />
          </button>
        }
      />

      {/* Filter pills */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 lg:px-0">
        {FILTERS.map((f) => {
          const count = MATCHES.filter((m) =>
            f.id === "live" ? m.status === "live" || m.status === "ht" : m.status === f.id,
          ).length;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all",
                active
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted-foreground ring-1 ring-black/5 hover:text-foreground",
              )}
            >
              {f.label}
              <span className={cn("ml-2 tabular-nums", active ? "opacity-70" : "opacity-50")}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Featured AI banner + comparator (side-by-side on desktop) */}
      <div className="grid gap-4 px-4 lg:grid-cols-3 lg:gap-5 lg:px-0">
        <Link
          to="/match/$id"
          params={{ id: "rma-fcb" }}
          className="group relative block overflow-hidden rounded-3xl bg-foreground p-5 text-background shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl lg:col-span-2 lg:p-7"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-data/40 blur-3xl transition-transform group-hover:scale-110" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-brand/30 blur-3xl transition-transform group-hover:scale-110" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand ring-1 ring-brand/30">
              <Sparkles className="size-3" /> Analyse IA · Match du jour
            </div>
            <h2 className="text-[22px] font-black leading-tight tracking-tight lg:text-3xl">
              Real Madrid <span className="text-muted-foreground">vs</span> FC Barcelone
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-white/70 lg:text-sm">
              El Clásico — Bernabéu · 21:00. Modèle prédictif : victoire à domicile probable
              (64% de confiance).
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center lg:max-w-md">
              <MiniProb label="RMA" value={48} tone="brand" />
              <MiniProb label="Nul" value={22} tone="muted" />
              <MiniProb label="FCB" value={30} tone="data" />
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold">
              <span>Voir l'analyse complète</span>
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </Link>

        <Link
          to="/analyse"
          className="hidden overflow-hidden rounded-3xl bg-brand/10 p-6 ring-1 ring-brand/20 transition-all hover:bg-brand/15 lg:flex lg:flex-col lg:justify-between"
        >
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
              <Sparkles className="size-3" /> Comparateur
            </div>
            <h3 className="text-xl font-black leading-tight tracking-tight">
              Analysez deux équipes de votre choix
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Probabilités 1X2, marchés recommandés et facteurs clés — instantanément.
            </p>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 text-xs font-black text-brand">
            Lancer une analyse <ChevronRight className="size-4" />
          </div>
        </Link>
      </div>

      {/* Grouped matches */}
      <div className="mt-8 space-y-6 px-4 lg:px-0">
        {grouped.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucun match dans cette catégorie.
          </div>
        )}
        {grouped.map(({ comp, matches }) => (
          <section key={comp.id}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: comp.color }} />
                <h3 className="text-[11px] font-black uppercase tracking-[0.16em]">{comp.name}</h3>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">{comp.country}</span>
            </div>
            <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
              {matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* CTA (mobile only — desktop shows it inline above) */}
      <div className="mt-8 px-4 lg:hidden">
        <Link
          to="/analyse"
          className="flex items-center justify-between rounded-2xl bg-brand/10 p-4 ring-1 ring-brand/20 transition-transform active:scale-[0.99]"
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-brand">Comparateur</div>
            <div className="mt-1 text-sm font-bold">Analyser deux équipes de votre choix</div>
          </div>
          <div className="grid size-10 place-items-center rounded-full bg-brand text-brand-foreground">
            <ChevronRight className="size-4" />
          </div>
        </Link>
      </div>
    </AppShell>
  );
}

function MiniProb({ label, value, tone }: { label: string; value: number; tone: "brand" | "muted" | "data" }) {
  const color =
    tone === "brand" ? "bg-brand/20 text-brand" : tone === "data" ? "bg-data/20 text-data" : "bg-white/10 text-white/70";
  return (
    <div className={cn("rounded-xl px-2 py-2", color)}>
      <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">{label}</div>
      <div className="text-lg font-black tabular-nums leading-none">{value}%</div>
    </div>
  );
}
