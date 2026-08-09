import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  Coins,
  Menu,
  Radio,
  Search,
  Sparkles,
  Star,
  Ticket,
  User,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { SearchProvider, SmartSearchTrigger, useSearchDialog } from "@/components/SmartSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationPopover } from "@/components/NotificationPopover";
import { useSession } from "@/hooks/use-session";
import { ReferralPopup } from "@/components/ReferralPopup";
import { useReferralPopup } from "@/hooks/use-referral-popup";
import { getMyBalance } from "@/lib/analyses.functions";
import { PremiumStatusBadge } from "@/components/PremiumStatusBadge";

const NAV = [
  {
    to: "/",
    label: "Matchs",
    icon: Radio,
    match: (p: string) => p === "/" || p.startsWith("/match"),
  },
  {
    to: "/analyse",
    label: "Analyse",
    icon: Sparkles,
    match: (p: string) => p.startsWith("/analyse"),
  },
  {
    to: "/communaute",
    label: "Communauté",
    icon: Users,
    match: (p: string) => p.startsWith("/communaute"),
  },
  { to: "/favoris", label: "Favoris", icon: Star, match: (p: string) => p.startsWith("/favoris") },
  { to: "/profil", label: "Profil", icon: User, match: (p: string) => p.startsWith("/profil") },
] as const;

const SIDEBAR_GROUPS = [
  {
    label: "LiveFoot",
    items: [NAV[0], NAV[1]],
  },
  {
    label: "Mon espace",
    items: [NAV[3], NAV[2], NAV[4]],
  },
  {
    label: "Partenaires",
    items: [
      {
        to: "/codes-promo",
        label: "Codes promo",
        icon: Ticket,
        match: (p: string) => p.startsWith("/codes-promo"),
      },
    ],
  },
] as const;

function GlobalReferralPopup() {
  const { variant, dismiss } = useReferralPopup();
  return <ReferralPopup variant={variant} onDismiss={dismiss} />;
}

export function AppShell({
  children,
  hideHeader = false,
}: {
  children: ReactNode;
  hideHeader?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <SearchProvider>
      <div className="score-shell min-h-screen bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-foreground focus:px-3 focus:py-2 focus:text-xs focus:font-bold focus:text-background"
        >
          Aller au contenu
        </a>

        <DesktopSidebar pathname={pathname} />
        {mobileNavOpen && (
          <MobileDrawer pathname={pathname} onClose={() => setMobileNavOpen(false)} />
        )}

        <div className="lg:pl-[250px]">
          <div className="mx-auto flex min-h-screen max-w-[440px] flex-col border-x border-border/60 bg-background lg:max-w-none lg:border-x-0">
            {!hideHeader && <TopBar onMenuOpen={() => setMobileNavOpen(true)} />}
            <main
              id="main-content"
              className="flex-1 pb-28 lg:mx-auto lg:w-full lg:max-w-[980px] lg:pb-12 lg:pt-2"
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
      className="score-sidebar fixed left-0 top-0 z-40 hidden h-dvh w-[250px] flex-col border-r border-[#252525] bg-[#111111] text-[#fdfdfd] lg:flex"
      aria-label="Navigation latérale"
    >
      <Link to="/" className="flex items-center gap-3 border-b border-[#252525] px-5 py-5">
        <div className="grid size-10 place-items-center overflow-hidden rounded-xl bg-[#202020] ring-1 ring-white/10">
          <img src="/logo.png" alt="LiveFoot IA" className="size-10 object-cover" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[16px] font-black tracking-tight">
            LiveFoot <span className="text-brand">IA</span>
          </span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#888888]">
            Scores · Analyse
          </span>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#777777]">
              {group.label}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-semibold transition-colors",
                        active
                          ? "bg-[#fdfdfd] text-[#111111]"
                          : "text-[#aaaaaa] hover:bg-[#1e1e1e] hover:text-[#fdfdfd]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-[17px] transition-transform group-hover:scale-105",
                          active && "text-brand",
                        )}
                        strokeWidth={active ? 2.6 : 2}
                      />
                      <span>{item.label}</span>
                      {active && <span className="ml-auto size-1.5 rounded-full bg-brand" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="rounded-xl border border-brand/25 bg-brand/10 p-3.5">
          <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand">
            <Sparkles className="size-2.5" /> Intelligence Hub
          </div>
          <div className="text-[13px] font-bold leading-tight text-[#fdfdfd]">
            Radar, alertes et scorecard
          </div>
          <p className="mt-1 text-[11px] leading-snug text-[#aaaaaa]">
            Centralisez vos signaux Premium.
          </p>
          <Link
            to="/premium/tableau-de-bord"
            className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-brand py-2 text-[11px] font-black text-brand-foreground transition-transform hover:scale-[1.02]"
          >
            Ouvrir le Hub <ArrowRight className="size-3" />
          </Link>
        </div>
      </nav>

      <div className="space-y-3 border-t border-[#252525] p-3">
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777777]">
            Thème
          </span>
          <ThemeToggle compact />
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/profil"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#1e1e1e]"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fdfdfd] text-xs font-black text-[#111111]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-[#fdfdfd]">{displayName}</div>
              <div className="text-[10px] text-[#888888]">Mon profil</div>
            </div>
          </Link>
          <PremiumStatusBadge profile={profile} compact />
        </div>
      </div>
    </aside>
  );
}

function MobileDrawer({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu principal"
    >
      <button
        type="button"
        aria-label="Fermer le menu"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-[min(86vw,320px)] flex-col border-r border-[#252525] bg-[#111111] text-[#fdfdfd] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#252525] px-5 py-5">
          <Link to="/" onClick={onClose} className="flex items-center gap-3">
            <img src="/logo.png" alt="LiveFoot IA" className="size-10 rounded-xl object-cover" />
            <span className="text-base font-black">
              LiveFoot <span className="text-brand">IA</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-[#202020] text-[#aaaaaa] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#777777]">
                {group.label}
              </div>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = item.match(pathname);
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold",
                          active
                            ? "bg-[#fdfdfd] text-[#111111]"
                            : "text-[#aaaaaa] hover:bg-[#1e1e1e] hover:text-[#fdfdfd]",
                        )}
                      >
                        <Icon className={cn("size-[18px]", active && "text-brand")} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-[#252525] p-4 text-xs text-[#888888]">
          Scores en direct · Analyses football
        </div>
      </aside>
    </div>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 border-t border-border/60 bg-background/95 pb-6 pt-2 backdrop-blur-xl lg:hidden"
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
                    active && "scale-105 bg-brand/10",
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={active ? 2.5 : 2} />
                </span>
                {item.label === "Communauté" ? "Commu." : item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopBar({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const { setOpen } = useSearchDialog();
  const { user } = useSession();
  const { data: profile } = useQuery({
    queryKey: ["me", "balance"],
    queryFn: () => getMyBalance(),
    enabled: !!user,
    staleTime: 30_000,
  });

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-3 py-3 backdrop-blur-xl lg:px-8 lg:py-3">
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Ouvrir le menu"
          className="grid size-9 place-items-center rounded-full bg-surface text-muted-foreground transition-colors hover:text-foreground"
        >
          <Menu className="size-4" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <div className="grid size-10 place-items-center overflow-hidden rounded-lg">
            <img src="/logo.png" alt="LiveFoot IA" className="size-10 object-cover" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight">
              LiveFoot <span className="text-brand">IA</span>
            </span>
            <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Scores · Analyse
            </span>
          </div>
        </Link>
      </div>

      <div className="hidden flex-1 items-center gap-3 lg:flex">
        <SmartSearchTrigger />
      </div>

      <div className="flex items-center gap-2">
        <PremiumStatusBadge profile={profile} compact className="hidden sm:inline-flex" />
        <button
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-full bg-surface ring-1 ring-black/5 transition-transform hover:scale-105 active:scale-95 lg:hidden dark:ring-white/10"
          aria-label="Ouvrir la recherche"
        >
          <Search className="size-4" aria-hidden />
        </button>
        <Link
          to="/profil"
          className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 ring-1 ring-black/5 lg:hidden dark:ring-white/10"
        >
          <Coins className="size-3.5 text-brand" aria-hidden />
          <span className="text-xs font-bold tabular-nums">Crédits</span>
        </Link>
        <NotificationPopover />
      </div>
    </header>
  );
}

export function PageTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between px-4 pb-4 pt-6 lg:px-0 lg:pt-7">
      <div>
        {eyebrow && (
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[26px] font-black leading-none tracking-tight lg:text-4xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}
