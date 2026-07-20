import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Radio, Trophy, Users, Sparkles } from "lucide-react";
import { TEAMS } from "@/data/teams";
import { COMPETITIONS } from "@/data/competitions";
import { MATCHES } from "@/data/matches";
import { team } from "@/data/teams";

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const SearchCtx = createContext<Ctx | null>(null);

export function useSearchDialog(): Ctx {
  const ctx = useContext(SearchCtx);
  if (!ctx) return { open: false, setOpen: () => {} };
  return ctx;
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (path: string, params?: Record<string, string>) => {
    setOpen(false);
    if (params) navigate({ to: path as never, params: params as never });
    else navigate({ to: path as never });
  };

  return (
    <SearchCtx.Provider value={{ open, setOpen }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title="Recherche" description="Trouvez matchs, équipes et compétitions">
        <CommandInput placeholder="Rechercher un match, une équipe, une compétition…" />
        <CommandList aria-label="Résultats de recherche">
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>

          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => go("/analyse")}>
              <Sparkles className="mr-2 size-4 text-brand" aria-hidden />
              <span>Lancer une analyse IA</span>
              <kbd className="ml-auto text-[10px] text-muted-foreground">Entrée</kbd>
            </CommandItem>
            <CommandItem onSelect={() => go("/communaute")}>
              <Users className="mr-2 size-4 text-data" aria-hidden />
              <span>Ouvrir la communauté</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Matchs du jour">
            {MATCHES.slice(0, 8).map((m) => {
              const h = team(m.homeId);
              const a = team(m.awayId);
              const label = `${h.short} contre ${a.short}${
                m.status === "live" ? `, en direct à la ${m.minute}e minute` : m.status === "finished" ? `, terminé ${m.homeScore}-${m.awayScore}` : `, coup d'envoi ${m.kickoff}`
              }`;
              return (
                <CommandItem
                  key={m.id}
                  value={`${h.name} ${a.name} ${h.short} ${a.short}`}
                  onSelect={() => go("/match/$id", { id: m.id })}
                  aria-label={label}
                >
                  <Radio className="mr-2 size-4 text-alert" aria-hidden />
                  <span className="font-semibold">{h.short}</span>
                  <span className="mx-1.5 text-muted-foreground">vs</span>
                  <span className="font-semibold">{a.short}</span>
                  <span className="ml-auto text-[10px] font-bold tabular-nums text-muted-foreground">
                    {m.status === "live" ? `${m.minute}'` : m.status === "finished" ? "FT" : m.kickoff}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Équipes">
            {TEAMS.map((t) => (
              <CommandItem
                key={t.id}
                value={`${t.name} ${t.short} ${t.country}`}
                onSelect={() => go("/analyse")}
              >
                <span
                  className="mr-2 grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-black text-white"
                  style={{ background: t.color }}
                  aria-hidden
                >
                  {t.initials.slice(0, 2)}
                </span>
                <span className="font-semibold">{t.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{t.country}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Compétitions">
            {COMPETITIONS.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.name} ${c.short} ${c.country}`}
                onSelect={() => go("/communaute")}
              >
                <Trophy className="mr-2 size-4" style={{ color: c.color }} aria-hidden />
                <span className="font-semibold">{c.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{c.country}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SearchCtx.Provider>
  );
}

/** Trigger button rendered inside desktop TopBar. */
export function SmartSearchTrigger() {
  const { setOpen } = useSearchDialog();
  return (
    <button
      onClick={() => setOpen(true)}
      className="group flex w-full max-w-md items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-left ring-1 ring-black/5 transition-all hover:ring-black/10 focus:ring-2 focus:ring-brand"
      aria-label="Ouvrir la recherche (Ctrl+K)"
    >
      <svg className="size-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <span className="flex-1 text-sm text-muted-foreground">Rechercher un match, une équipe…</span>
      <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground md:inline">
        ⌘K
      </kbd>
    </button>
  );
}
