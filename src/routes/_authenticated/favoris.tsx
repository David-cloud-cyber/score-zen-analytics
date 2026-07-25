import { createFileRoute } from "@tanstack/react-router";
import { Bell, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/favoris")({
  head: () => ({
    meta: [
      { title: "Mes favoris & alertes — LiveFoot AI" },
      { name: "description", content: "Retrouvez toutes vos équipes, joueurs et compétitions favoris, et gérez vos alertes en temps réel." },
      { property: "og:title", content: "Mes favoris & alertes — LiveFoot AI" },
      { property: "og:description", content: "Équipes, joueurs, compétitions favorites et alertes de buts personnalisées." },
      { property: "og:url", content: "https://ball-predict-ace.lovable.app/favoris" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://ball-predict-ace.lovable.app/favoris" }],
  }),
  component: FavorisPage,
});

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
              tab === id ? "bg-foreground text-background" : "bg-surface text-muted-foreground ring-1 ring-black/5 dark:ring-white/10",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4">
        {tab === "teams" && (
          <EmptyState
            icon={<Star className="size-5 text-warn" />}
            title="Aucune équipe favorite"
            msg="Ajoutez vos équipes préférées depuis la page des matchs en direct pour les retrouver ici."
          />
        )}
        {tab === "players" && (
          <EmptyState
            icon={<Star className="size-5 text-warn" />}
            title="Aucun joueur favori"
            msg="Les favoris joueurs seront disponibles prochainement."
          />
        )}
        {tab === "comps" && (
          <EmptyState
            icon={<Star className="size-5 text-warn" />}
            title="Aucune compétition favorite"
            msg="Ajoutez vos compétitions préférées depuis la page des matchs en direct."
          />
        )}
        {tab === "notif" &&
          NOTIF_TYPES.map((n) => <NotifRow key={n.id} label={n.label} desc={n.desc} />)}
      </div>
    </AppShell>
  );
}

function EmptyState({ icon, title, msg }: { icon: React.ReactNode; title: string; msg: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center">
      <div className="grid size-10 place-items-center rounded-full bg-warn/10">{icon}</div>
      <div className="text-sm font-bold">{title}</div>
      <div className="max-w-xs text-xs text-muted-foreground">{msg}</div>
    </div>
  );
}

function NotifRow({ label, desc }: { label: string; desc: string }) {
  const [on, setOn] = useState(true);
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card p-3 ring-1 ring-black/5 dark:ring-white/5">
      <div className="grid size-10 place-items-center rounded-full bg-surface">
        <Bell className="size-4 text-foreground" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-[11px] leading-snug text-muted-foreground">{desc}</div>
      </div>
      <button
        onClick={() => {
          setOn(!on);
          toast.success(!on ? `${label} activées.` : `${label} désactivées.`);
        }}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-brand" : "bg-muted")}
        aria-label="Basculer"
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
