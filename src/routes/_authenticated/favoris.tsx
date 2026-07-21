import { createFileRoute } from "@tanstack/react-router";
import { Bell, Star } from "lucide-react";
import { useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { TeamCrest } from "@/components/TeamCrest";
import { TEAMS } from "@/data/teams";
import { COMPETITIONS } from "@/data/competitions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/favoris")({
  head: () => ({
    meta: [
      { title: "Favoris — LiveFoot AI" },
      { name: "description", content: "Retrouvez toutes vos équipes, joueurs et compétitions favoris." },
    ],
  }),
  component: FavorisPage,
});

const FAV_TEAMS = ["rma", "psg", "liv", "bay"];
const FAV_PLAYERS = [
  { name: "Vinícius Jr", teamId: "rma", pos: "Ailier" },
  { name: "Kylian Mbappé", teamId: "rma", pos: "Attaquant" },
  { name: "Erling Haaland", teamId: "mci", pos: "Attaquant" },
  { name: "Ousmane Dembélé", teamId: "psg", pos: "Ailier" },
];
const FAV_COMPS = ["l1", "ucl", "pl"];

const NOTIF_TYPES = [
  { id: "goals", label: "Alertes de buts", desc: "Notification instantanée à chaque but des équipes favorites" },
  { id: "start", label: "Coup d'envoi", desc: "10 min avant le début du match" },
  { id: "lineup", label: "Compositions officielles", desc: "Dès leur publication" },
  { id: "ai", label: "Insights IA Premium", desc: "Prédictions à haute confiance" },
];

function FavorisPage() {
  const [tab, setTab] = useState<"teams" | "players" | "comps" | "notif">("teams");
  return (
    <AppShell>
      <PageTitle eyebrow="Personnel" title="Favoris" />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto px-4">
        {(
          [
            ["teams", "Équipes"],
            ["players", "Joueurs"],
            ["comps", "Compétitions"],
            ["notif", "Alertes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all",
              tab === id ? "bg-foreground text-background" : "bg-surface text-muted-foreground ring-1 ring-black/5",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4">
        {tab === "teams" &&
          FAV_TEAMS.map((id) => {
            const t = TEAMS.find((x) => x.id === id)!;
            return (
              <FavRow key={id} left={<TeamCrest team={t} size={40} />} title={t.name} subtitle={t.country} />
            );
          })}
        {tab === "players" &&
          FAV_PLAYERS.map((p, i) => {
            const t = TEAMS.find((x) => x.id === p.teamId)!;
            return (
              <FavRow key={i} left={<TeamCrest team={t} size={40} />} title={p.name} subtitle={`${p.pos} · ${t.short}`} />
            );
          })}
        {tab === "comps" &&
          FAV_COMPS.map((id) => {
            const c = COMPETITIONS.find((x) => x.id === id)!;
            return (
              <FavRow
                key={id}
                left={<div className="grid size-10 place-items-center rounded-full text-xs font-black text-white" style={{ background: c.color }}>{c.short.slice(0, 2).toUpperCase()}</div>}
                title={c.name}
                subtitle={c.country}
              />
            );
          })}
        {tab === "notif" &&
          NOTIF_TYPES.map((n) => <NotifRow key={n.id} label={n.label} desc={n.desc} />)}
      </div>
    </AppShell>
  );
}

function FavRow({ left, title, subtitle }: { left: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-black/5">
      {left}
      <div className="flex-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <button className="grid size-9 place-items-center rounded-full bg-brand/10 text-brand" aria-label="Retirer">
        <Star className="size-4 fill-current" />
      </button>
    </div>
  );
}

function NotifRow({ label, desc }: { label: string; desc: string }) {
  const [on, setOn] = useState(true);
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card p-3 ring-1 ring-black/5">
      <div className="grid size-10 place-items-center rounded-full bg-surface">
        <Bell className="size-4 text-foreground" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-[11px] leading-snug text-muted-foreground">{desc}</div>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-brand" : "bg-muted")}
        aria-label="Basculer"
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
