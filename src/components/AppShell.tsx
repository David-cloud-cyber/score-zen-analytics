import { Link, useRouterState } from "@tanstack/react-router";
import { Radio, Sparkles, Star, User, Bell, Coins, Search, Users, Ticket } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SearchProvider, SmartSearchTrigger, useSearchDialog } from "@/components/SmartSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationPopover } from "@/components/NotificationPopover";
import { useSession } from "@/hooks/use-session";
import { ReferralPopup } from "@/components/ReferralPopup";
import { useReferralPopup } from "@/hooks/use-referral-popup";
import { useQuery } from "@tanstack/react-query";
import { getMyBalance } from "@/lib/analyses.functions";
import { PremiumStatusBadge } from "@/components/PremiumStatusBadge";

const NAV = [
  { to: "/", label: "Matchs", icon: Radio, match: (p: string) => p === "/" || p.startsWith("/match") },
  { to: "/analyse", label: "Analyse", icon: Sparkles, match: (p: string) => p.startsWith("/analyse") },
  { to: "/communaute", label: "Commu.", icon: Users, match: (p: string) => p.startsWith("/communaute") },
  { to: "/favoris", label: "Favoris", icon: Star, match: (p: string) => p.startsWith("/favoris") },
  { to: "/profil", label: "Profil", icon: User, match: (p: string) => p.startsWith("/profil") },
] as const;

/** Navigation desktop : identique à la nav mobile + l'onglet Codes promo. */
const SIDEBAR_NAV = [
  ...NAV.slice(0, 3),
  {
    to: "/codes-promo",
    label: "Codes promo",
    icon: Ticket,
    match: (p: string) => p.startsWith("/codes-promo"),
  },
  ...NAV.slice(3),
] as const;


/** Popup de parrainage / upsell — monté au niveau AppShell pour être disponible partout. */
function GlobalReferralPopup() {
  const { variant, dismiss } = useReferralPopup();

  return <ReferralPopup variant={variant} onDismiss={dismiss} />;
}

export function AppShell({ children, hideHeader = false }: { children: ReactNode; hideHeader?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <SearchProvider>
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-foreground focus:px-3 focus:py-2 focus:text-xs focus:font-bold focus:text-background"
      >
        Aller au contenu
      </a>

      <DesktopSidebar pathname={pathname} />

      <div className="lg:pl-64">
        <div className="mx-auto flex min-h-screen max-w-[440px] flex-col border-x border-border/60 bg-background lg:max-w-none lg:border-x-0">
          {!hideHeader && <TopBar />}
          <main
            id="main-content"
            className="flex-1 pb-28 lg:mx-auto lg:w-full lg:max-w-5xl lg:pb-12 lg:pt-2"
          >
            {children}
          </main>
          <MobileBottomNav pathname={pathname} />
        </div>
      </div>

      <GlobalReferralPopup />
    </div>
    </SearchProvider>
  );
}

function DesktopSidebar({ pathname }: { pathname: string }) {
  const { user } = useSession();
  const { data: profile } = useQuery({
    queryKey: ["me", "balance"],
    queryFn: () => getMyBalance(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Profil";
  const initials = displayName.slice(0, 2).toUpperCase();
  return (
    <aside
      className="fixed left-0 top-0 z-40 hidden h-dvh w-64 flex-col border-r border-border/60 bg-background/95 backdrop-blur-xl lg:flex"
      aria-label="Navigation latérale"
    >
      <Link
        to="/"
        className="flex items-center gap-2.5 border-b border-border/60 px-5 py-5 rounded-none"
      >
        <div className="grid size-11 place-items-center rounded-lg overflow-hidden">
          <img src="/logo.png" alt="LiveFoot AI" className="size-11 object-cover" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight">
            LiveFoot <span className="text-brand">AI</span>
          </span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Livescore · Analyse
          </span>
        </div>
      </Link>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {SIDEBAR_NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                    active
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn("size-[18px] transition-transform group-hover:scale-110", active && "text-brand")}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <span>{item.label}</span>
                  {active && <span className="ml-auto size-1.5 rounded-full bg-brand" />}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 rounded-2xl bg-gradient-to-br from-foreground to-neutral-800 p-4 text-background">
          <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-warn/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-warn">
            <Sparkles className="size-2.5" /> Premium
          </div>
          <div className="text-[13px] font-bold leading-tight">Analyses illimitées</div>
          <p className="mt-1 text-[11px] leading-snug text-background/60">
            Débloquez tous les modèles prédictifs.
          </p>
          <Link
            to="/premium"
            className="mt-3 block rounded-lg bg-warn py-1.5 text-center text-[11px] font-black text-neutral-900 transition-transform hover:scale-[1.02]"
          >
            Découvrir
          </Link>
        </div>
      </nav>

      <div className="space-y-3 border-t border-border/60 p-3">
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Thème</span>
          <ThemeToggle compact />
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/profil"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-xs font-black text-background">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold">{displayName}</div>
              <div className="text-[10px] text-muted-foreground">Mon profil</div>
            </div>
          </Link>
          <PremiumStatusBadge profile={profile} compact />
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 border-t border-border/60 bg-background/90 pb-6 pt-2 backdrop-blur-xl lg:hidden"
      aria-label="Navigation principale"
    >
      <ul className="grid grid-cols-5">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  active ? "text-brand" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-full transition-all",
                    active && "bg-brand/10 scale-105",
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={active ? 2.5 : 2} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopBar() {
  const { setOpen } = useSearchDialog();
  const { user } = useSession();
  const { data: profile } = useQuery({
    queryKey: ["me", "balance"],
    queryFn: () => getMyBalance(),
    enabled: !!user,
    staleTime: 30_000,
  });
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl lg:px-8 lg:py-4">
      <Link to="/" className="flex items-center gap-2 lg:hidden">
        <div className="grid size-10 place-items-center rounded-lg overflow-hidden">
          <img src="/logo.png" alt="LiveFoot AI" className="size-10 object-cover" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight">
            Livefoot <span className="text-brand">IA</span>
          </span>
          <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Livescore · Analyse
          </span>
        </div>
      </Link>

      <div className="hidden lg:flex lg:flex-1 lg:items-center lg:gap-3">
        <SmartSearchTrigger />
      </div>

      <div className="flex items-center gap-2">
        <PremiumStatusBadge profile={profile} compact className="hidden sm:inline-flex" />
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
        <button
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-full bg-surface ring-1 ring-black/5 transition-transform hover:scale-105 active:scale-95 lg:hidden dark:ring-white/10"
          aria-label="Ouvrir la recherche"
        >
          <Search className="size-4" aria-hidden />
        </button>
        <Link to="/profil" className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 ring-1 ring-black/5 lg:hidden dark:ring-white/10">
          <Coins className="size-3.5 text-warn" aria-hidden />
          <span className="text-xs font-bold tabular-nums">Crédits</span>
        </Link>
        <NotificationPopover />
      </div>
    </header>
  );
}

export function PageTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-4 pb-4 pt-6 lg:px-0 lg:pt-8">
      <div>
        {eyebrow && (
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</div>
        )}
        <h1 className="text-[26px] font-black leading-none tracking-tight lg:text-4xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}
