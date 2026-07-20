import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Crown, History, Settings, LogOut, ChevronRight, Coins, Sparkles, Plus, TrendingDown, TrendingUp, Check, Info, X } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { CREDIT_HISTORY, CREDIT_PACKS, CREDIT_RULES } from "@/data/community";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profil — LiveFoot AI" },
      { name: "description", content: "Votre tableau de bord LiveFoot AI : crédits, historique d'analyses et abonnement Premium." },
    ],
  }),
  component: ProfilPage,
});

function ProfilPage() {
  const [balance, setBalance] = useState(140);
  const [showTopup, setShowTopup] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const monthlyLimit = 300;
  const usedPct = Math.min(100, Math.round((balance / monthlyLimit) * 100));

  const handleTopup = (credits: number, price: string) => {
    setBalance((b) => b + credits);
    setShowTopup(false);
    setFlash(`+${credits} crédits ajoutés (${price})`);
    setTimeout(() => setFlash(null), 3000);
  };

  return (
    <AppShell>
      <PageTitle eyebrow="Compte" title="Profil" />

      {flash && (
        <div
          role="status"
          aria-live="polite"
          className="mx-4 mb-4 flex items-center gap-2 rounded-2xl bg-brand/10 px-3 py-2 text-xs font-bold text-brand ring-1 ring-brand/20 lg:mx-0"
        >
          <Check className="size-4" aria-hidden /> {flash}
        </div>
      )}

      <div className="px-4 lg:px-0">
        <div className="flex items-center gap-4 rounded-3xl bg-card p-4 ring-1 ring-black/5">
          <div className="grid size-16 place-items-center rounded-full bg-foreground text-2xl font-black text-background">
            AL
          </div>
          <div className="flex-1">
            <div className="text-base font-black">Alex Leroy</div>
            <div className="text-xs text-muted-foreground">alex.leroy@livefoot.ai</div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-black/5">
              Plan Gratuit · Membre depuis 2024
            </div>
          </div>
        </div>
      </div>

      {/* Credits wallet — hero card */}
      <section aria-labelledby="wallet-title" className="mt-4 px-4 lg:px-0">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-foreground via-neutral-900 to-neutral-800 p-5 text-background">
          <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-warn/25 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full bg-brand/20 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-warn/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-warn">
                  <Coins className="size-3" aria-hidden /> Solde de crédits
                </div>
                <h2 id="wallet-title" className="text-4xl font-black tabular-nums leading-none">
                  {balance}
                </h2>
                <p className="mt-1 text-[11px] text-white/60">≈ {Math.floor(balance / 3)} analyses IA restantes</p>
              </div>
              <button
                onClick={() => setShowTopup(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-warn px-3 py-2 text-xs font-black text-neutral-900 transition-transform hover:scale-105 active:scale-95"
                aria-label="Recharger des crédits"
              >
                <Plus className="size-3.5" aria-hidden /> Recharger
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/60">
                <span>Consommation du mois</span>
                <span className="tabular-nums text-white">{balance} / {monthlyLimit}</span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={usedPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Solde utilisé ${usedPct}%`}
              >
                <div className="h-full rounded-full bg-warn transition-all" style={{ width: `${usedPct}%` }} aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <div className="mt-4 grid grid-cols-3 gap-3 px-4 lg:px-0">
        <StatCard value="27" label="Analyses" icon={<Sparkles className="size-3.5 text-data" />} />
        <StatCard value="68%" label="Précision" />
        <StatCard value="5j" label="Série" />
      </div>

      {/* Usage rules */}
      <section aria-labelledby="rules-title" className="mt-6 px-4 lg:px-0">
        <div className="mb-3 flex items-center gap-2">
          <Info className="size-3.5 text-muted-foreground" aria-hidden />
          <h3 id="rules-title" className="text-[11px] font-black uppercase tracking-widest">
            Règles d'utilisation
          </h3>
        </div>
        <ul className="space-y-2 rounded-2xl bg-card ring-1 ring-black/5" role="list">
          {CREDIT_RULES.map((r) => (
            <li key={r.label} className="flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
              <div
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-black tabular-nums ring-1",
                  r.cost === 0
                    ? "bg-brand/10 text-brand ring-brand/20"
                    : "bg-warn/10 text-warn ring-warn/20",
                )}
                aria-label={r.cost === 0 ? "Gratuit" : `${r.cost} crédits`}
              >
                {r.cost === 0 ? "0" : `-${r.cost}`}
              </div>
              <div className="flex-1">
                <div className="text-xs font-black">{r.label}</div>
                <div className="text-[11px] leading-snug text-muted-foreground">{r.desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Credit history */}
      <section aria-labelledby="history-title" className="mt-6 px-4 lg:px-0">
        <div className="mb-3 flex items-center justify-between">
          <h3 id="history-title" className="text-[11px] font-black uppercase tracking-widest">
            Historique des crédits
          </h3>
          <button className="text-[10px] font-bold text-brand">Tout voir</button>
        </div>
        <ul className="rounded-2xl bg-card ring-1 ring-black/5" role="list">
          {CREDIT_HISTORY.map((h) => {
            const positive = h.amount > 0;
            return (
              <li key={h.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
                <div
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full",
                    positive ? "bg-brand/10 text-brand" : "bg-alert/10 text-alert",
                  )}
                  aria-hidden
                >
                  {positive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black">{h.label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{h.detail} · {h.date}</div>
                </div>
                <div
                  className={cn(
                    "shrink-0 tabular-nums text-sm font-black",
                    positive ? "text-brand" : "text-alert",
                  )}
                  aria-label={`${positive ? "Crédité de" : "Débité de"} ${Math.abs(h.amount)} crédits`}
                >
                  {positive ? "+" : ""}{h.amount}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Premium upsell */}
      <div className="mt-6 px-4 lg:px-0">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand/15 via-card to-card p-5 ring-1 ring-brand/20">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
            <Crown className="size-3" aria-hidden /> Premium
          </div>
          <h3 className="text-lg font-black leading-tight">Analyses illimitées, zéro crédit consommé</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Passez Premium pour débloquer toutes les analyses IA et les modèles prédictifs
            avancés — les crédits redeviennent bonus.
          </p>
          <button className="mt-4 w-full rounded-2xl bg-foreground py-3 text-sm font-black text-background transition-transform active:scale-[0.98]">
            Essayer Premium — 9,99 € / mois
          </button>
        </div>
      </div>

      {/* Menu */}
      <section className="mt-6 space-y-2 px-4 lg:px-0" aria-label="Menu du compte">
        <MenuRow icon={<Settings className="size-4" />} label="Paramètres" />
        <MenuRow icon={<History className="size-4" />} label="Historique d'analyses" />
        <MenuRow icon={<LogOut className="size-4" />} label="Se déconnecter" tone="alert" />
      </section>

      <div className="mt-6 px-4 pb-4 lg:px-0">
        <Link to="/" className="block text-center text-[10px] font-semibold text-muted-foreground">
          LiveFoot AI · v0.9 démo · © 2026
        </Link>
      </div>

      {/* Topup dialog */}
      {showTopup && (
        <TopupDialog onClose={() => setShowTopup(false)} onBuy={handleTopup} />
      )}
    </AppShell>
  );
}

function StatCard({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-black/5">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 text-xl font-black tabular-nums leading-none">{value}</div>
    </div>
  );
}

function MenuRow({ icon, label, tone }: { icon: React.ReactNode; label: string; tone?: "alert" }) {
  return (
    <button className={`flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left text-sm font-bold ring-1 ring-black/5 ${tone === "alert" ? "text-alert" : ""}`}>
      <span className={`grid size-8 place-items-center rounded-full ${tone === "alert" ? "bg-alert/10" : "bg-surface"}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </button>
  );
}

function TopupDialog({ onClose, onBuy }: { onClose: () => void; onBuy: (credits: number, price: string) => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/50 backdrop-blur-sm sm:place-items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-warn">
              <Coins className="size-3" aria-hidden /> Recharge de crédits
            </div>
            <h2 id="topup-title" className="text-xl font-black leading-tight">Choisir un pack</h2>
            <p className="mt-1 text-xs text-muted-foreground">Simulation — aucun paiement réel.</p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full bg-surface ring-1 ring-black/5"
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {CREDIT_PACKS.map((p) => (
            <button
              key={p.id}
              onClick={() => onBuy(p.credits, p.price)}
              className={cn(
                "relative flex flex-col items-start gap-1 rounded-2xl p-3 text-left ring-1 transition-all hover:-translate-y-0.5",
                p.best
                  ? "bg-brand/10 ring-brand/40 hover:ring-brand"
                  : "bg-card ring-black/5 hover:ring-black/10",
              )}
              aria-label={`Acheter ${p.credits} crédits pour ${p.price}`}
            >
              {p.best && (
                <span className="absolute -top-2 right-3 rounded-full bg-brand px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand-foreground">
                  Populaire
                </span>
              )}
              <div className="flex items-center gap-1 text-warn">
                <Coins className="size-3.5" aria-hidden />
                <span className="text-[10px] font-black uppercase tracking-widest">Crédits</span>
              </div>
              <div className="text-2xl font-black tabular-nums leading-none">{p.credits}</div>
              <div className="text-sm font-black">{p.price}</div>
              <div className="text-[10px] text-muted-foreground">{p.perAnalysis}</div>
            </button>
          ))}
        </div>

        <p className="mt-4 text-[10px] leading-snug text-muted-foreground">
          Les crédits sont utilisés pour les analyses IA (3 crédits par match). Le livescore
          et les statistiques restent gratuits. Les crédits non utilisés sont conservés
          indéfiniment.
        </p>
      </div>
    </div>
  );
}
