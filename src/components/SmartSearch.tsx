import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Users, Sparkles, Star, User } from "lucide-react";

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

  const go = (path: string) => {
    setOpen(false);
    navigate({ to: path as never });
  };

  return (
    <SearchCtx.Provider value={{ open, setOpen }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Rechercher une action…" />
        <CommandList aria-label="Résultats de recherche">
          <CommandEmpty>Aucun résultat.</CommandEmpty>

          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => go("/")}>
              <Sparkles className="mr-2 size-4 text-brand" aria-hidden />
              <span>Matchs en direct</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/analyse")}>
              <Sparkles className="mr-2 size-4 text-brand" aria-hidden />
              <span>Lancer une analyse IA</span>
              <kbd className="ml-auto text-[10px] text-muted-foreground">Entrée</kbd>
            </CommandItem>
            <CommandItem onSelect={() => go("/communaute")}>
              <Users className="mr-2 size-4 text-data" aria-hidden />
              <span>Communauté</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/codes-promo")}>
              <Ticket className="mr-2 size-4 text-warn" aria-hidden />
              <span>Codes promo bookmakers</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/favoris")}>
              <Star className="mr-2 size-4 text-warn" aria-hidden />
              <span>Mes favoris</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/profil")}>
              <User className="mr-2 size-4 text-muted-foreground" aria-hidden />
              <span>Mon profil</span>
            </CommandItem>
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
      className="group flex w-full max-w-md items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-left ring-1 ring-black/5 transition-all hover:ring-black/10 focus:ring-2 focus:ring-brand dark:ring-white/10"
      aria-label="Ouvrir la recherche (Ctrl+K)"
    >
      <svg className="size-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <span className="flex-1 text-sm text-muted-foreground">Rechercher une action…</span>
      <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground md:inline">
        ⌘K
      </kbd>
    </button>
  );
}
