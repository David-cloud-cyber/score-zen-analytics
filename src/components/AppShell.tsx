import { Link, useRouterState } from "@tanstack/react-router";
import { Radio, Sparkles, Star, User, Bell, Coins } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Matchs", icon: Radio, match: (p: string) => p === "/" || p.startsWith("/match") },
  { to: "/analyse", label: "Analyse", icon: Sparkles, match: (p: string) => p.startsWith("/analyse") },
  { to: "/favoris", label: "Favoris", icon: Star, match: (p: string) => p.startsWith("/favoris") },
  { to: "/profil", label: "Profil", icon: User, match: (p: string) => p.startsWith("/profil") },
] as const;

export function AppShell({ children, hideHeader = false }: { children: ReactNode; hideHeader?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[440px] flex-col border-x border-border/60 bg-background">
        {!hideHeader && <TopBar />}
        <main className="flex-1 pb-28">{children}</main>
        <nav
          className="fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 border-t border-border/60 bg-background/90 pb-6 pt-2 backdrop-blur-xl"
          aria-label="Navigation principale"
        >
          <ul className="grid grid-cols-4">
            {NAV.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                      active ? "text-brand" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-full transition-all",
                        active && "bg-brand/10",
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
      </div>
    </div>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl">
      <Link to="/" className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-lg bg-foreground text-background">
          <span className="text-[11px] font-black italic tracking-tighter">LF</span>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight">
            LiveFoot <span className="text-brand">AI</span>
          </span>
          <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Livescore · Analyse
          </span>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 ring-1 ring-black/5">
          <Coins className="size-3.5 text-warn" />
          <span className="text-xs font-bold tabular-nums">140</span>
        </div>
        <button
          className="relative grid size-9 place-items-center rounded-full bg-surface ring-1 ring-black/5"
          aria-label="Notifications"
        >
          <Bell className="size-4 text-foreground" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-alert" />
        </button>
      </div>
    </header>
  );
}

export function PageTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-4 pb-4 pt-6">
      <div>
        {eyebrow && (
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</div>
        )}
        <h1 className="text-[26px] font-black leading-none tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  );
}
