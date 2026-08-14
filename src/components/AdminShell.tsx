import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, BarChart3, BookOpen, ChevronLeft, ChevronRight, CreditCard, FileText, Gauge, History, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";

const items = [
  ["/admin", "Vue générale", LayoutDashboard],
  ["/admin/utilisateurs", "Utilisateurs", Users],
  ["/admin/paiements", "Paiements", CreditCard],
  ["/admin/analyses", "Analyses", BarChart3],
  ["/admin/api", "Matchs & API", Activity],
  ["/admin/communaute", "Communauté", Users],
  ["/admin/contenus", "Contenus", BookOpen],
  ["/admin/exports", "Exports", FileText],
  ["/admin/audit", "Audit & sécurité", ShieldCheck],
  ["/admin/parametres", "Paramètres", Settings],
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, signOut } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="min-h-screen bg-background text-foreground">
    {mobileOpen && <button aria-label="Fermer le menu admin" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-border/70 bg-card transition-transform lg:translate-x-0", collapsed && "lg:w-[76px]", mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
      <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
        {!collapsed && <div><p className="text-sm font-black">LiveFoot <span className="text-brand">Admin</span></p><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Console sécurisée</p></div>}
        <button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden size-9 place-items-center rounded-xl border border-border/70 bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:grid" aria-label="Réduire la sidebar">{collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}</button>
        <button type="button" onClick={() => setMobileOpen(false)} className="grid size-9 place-items-center rounded-xl border border-border/70 bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden" aria-label="Fermer"><X className="size-4" /></button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(([to, label, Icon]) => <Link key={to} to={to as any} onClick={() => setMobileOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors", pathname === to ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground", collapsed && "lg:justify-center lg:px-2")} title={collapsed ? label : undefined}><Icon className="size-4 shrink-0" /><span className={cn(collapsed && "lg:hidden")}>{label}</span></Link>)}
      </nav>
      <div className={cn("border-t border-border/60 p-3", collapsed && "lg:px-2")}>
        {!collapsed && <p className="truncate px-2 text-[10px] text-muted-foreground">{user?.email ?? "Administrateur"}</p>}
        <button type="button" onClick={() => void signOut()} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><LogOut className="size-4" /><span className={cn(collapsed && "lg:hidden")}>Déconnexion</span></button>
      </div>
    </aside>
    <div className={cn("min-h-screen transition-[padding] lg:pl-[260px]", collapsed && "lg:pl-[76px]")}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/90 px-4 backdrop-blur-xl lg:px-8"><div className="flex items-center gap-3"><button type="button" onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-xl border border-border/70 bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden" aria-label="Ouvrir le menu"><Menu className="size-4" /></button><div><p className="text-[10px] font-black uppercase tracking-widest text-brand">Administration</p><h1 className="text-sm font-black">Pilotage LiveFoot</h1></div></div><span className="hidden items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-[10px] font-black text-brand sm:inline-flex"><Gauge className="size-3.5" /> Système protégé</span></header>
      <main className="mx-auto max-w-[1320px] p-4 pb-12 lg:p-8">{children}</main>
    </div>
  </div>;
}

export function AdminSection({ eyebrow, title, description, children, action }: { eyebrow: string; title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-widest text-brand">{eyebrow}</p><h2 className="mt-1 text-2xl font-black tracking-tight">{title}</h2>{description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>{action}</div>{children}</section>;
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn("rounded-2xl border border-border/70 bg-card p-4 shadow-sm", className)}>{children}</div>; }
export function AdminLoading() { return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-surface" />)}</div>; }
