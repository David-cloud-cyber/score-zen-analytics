import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, History, Settings, LogOut, ChevronRight, Coins, Sparkles } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profil — LiveFoot AI" },
      { name: "description", content: "Votre tableau de bord LiveFoot AI : crédits, historique d'analyses et abonnement Premium." },
    ],
  }),
  component: ProfilPage,
});

const HISTORY = [
  { pair: "Real Madrid vs FC Barcelone", when: "Il y a 2 h", pick: "1X — 81%" },
  { pair: "PSG vs Olympique de Marseille", when: "Hier", pick: "+2.5 buts — 78%" },
  { pair: "Man City vs Liverpool", when: "Hier", pick: "BTTS Oui — 72%" },
  { pair: "Bayern vs Dortmund", when: "Il y a 2 j", pick: "Victoire Bayern — 84%" },
  { pair: "Juventus vs Inter", when: "Il y a 3 j", pick: "Double Chance X2 — 65%" },
];

function ProfilPage() {
  return (
    <AppShell>
      <PageTitle eyebrow="Compte" title="Profil" />

      <div className="px-4">
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

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-3 gap-3 px-4">
        <StatCard value="140" label="Crédits" icon={<Coins className="size-3.5 text-warn" />} />
        <StatCard value="27" label="Analyses" icon={<Sparkles className="size-3.5 text-data" />} />
        <StatCard value="68%" label="Précision" />
      </div>

      {/* Premium upsell */}
      <div className="mt-6 px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-foreground via-foreground to-neutral-800 p-5 text-background">
          <div className="pointer-events-none absolute -right-16 -top-10 size-48 rounded-full bg-warn/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 size-48 rounded-full bg-brand/20 blur-3xl" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-warn/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-warn">
              <Crown className="size-3" /> Premium
            </div>
            <h3 className="text-xl font-black leading-tight">Passez à LiveFoot AI Premium</h3>
            <p className="mt-2 text-xs text-white/70">
              Analyses IA illimitées, statistiques avancées, alertes premium et modèles
              prédictifs exclusifs.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs">
              {[
                "Analyses IA illimitées (au lieu de 5/jour)",
                "xG et stats avancées sur tous les matchs",
                "Modèles prédictifs exclusifs (BTTS+, corners, cartons)",
                "Alertes premium & résultats en priorité",
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-white/85">
                  <span className="grid size-4 shrink-0 place-items-center rounded-full bg-brand/25 text-[10px] font-black text-brand">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button className="mt-5 w-full rounded-2xl bg-warn py-3 text-sm font-black text-neutral-900 shadow-lg shadow-warn/20">
              Essayer Premium — 9,99 € / mois
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <section className="mt-6 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-black uppercase tracking-widest">Historique d'analyses</h3>
          <button className="text-[10px] font-bold text-brand">Tout voir</button>
        </div>
        <ul className="space-y-2 rounded-2xl bg-card ring-1 ring-black/5">
          {HISTORY.map((h, i) => (
            <li key={i} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
              <div className="grid size-8 place-items-center rounded-full bg-data/10 text-data">
                <History className="size-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold">{h.pair}</div>
                <div className="text-[10px] text-muted-foreground">{h.when} · Suggéré : {h.pick}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </li>
          ))}
        </ul>
      </section>

      {/* Menu */}
      <section className="mt-6 space-y-2 px-4">
        <MenuRow icon={<Settings className="size-4" />} label="Paramètres" />
        <MenuRow icon={<LogOut className="size-4" />} label="Se déconnecter" tone="alert" />
      </section>

      <div className="mt-6 px-4 pb-4">
        <Link to="/" className="block text-center text-[10px] font-semibold text-muted-foreground">
          LiveFoot AI · v0.9 démo · © 2026
        </Link>
      </div>
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
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}
