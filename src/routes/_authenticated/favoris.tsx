import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, Star, Crown, Lock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { getMyBalance } from "@/lib/analyses.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/favoris")({
  head: () => ({
    meta: [
      { title: "Mes favoris & alertes — ScoreZen AI" },
      { name: "description", content: "Retrouvez toutes vos équipes, joueurs et compétitions favoris, et gérez vos alertes en temps réel." },
      { property: "og:title", content: "Mes favoris & alertes — ScoreZen AI" },
      { property: "og:description", content: "Équipes, joueurs, compétitions favorites et alertes de buts personnalisées." },
      { property: "og:url", content: "https://www.livefoot.fun/favoris" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://www.livefoot.fun/favoris" }],
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
  const navigate = useNavigate();
  const [tab, setTab] = useState<"teams" | "players" | "comps" | "notif">("teams");
  const { data: profile } = useQuery({
    queryKey: ["me", "balance"],
    queryFn: () => getMyBalance(),
  });

  const isPremium = profile?.plan === "premium";

  // Demo local state for favorites
  const [favoriteTeams, setFavoriteTeams] = useState<Array<{ id: number; name: string; country: string }>>([
    { id: 541, name: "Real Madrid", country: "Espagne" },
    { id: 529, name: "FC Barcelone", country: "Espagne" },
    { id: 85, name: "Paris Saint-Germain", country: "France" },
  ]);

  const handleAddFavorite = (teamName: string) => {
    if (!isPremium && favoriteTeams.length >= 3) {
      toast.error("Limite atteinte : Les comptes gratuits sont limités à 3 favoris. Passez Premium pour des favoris illimités !");
      return;
    }
    setFavoriteTeams([...favoriteTeams, { id: Date.now(), name: teamName, country: "Europe" }]);
    toast.success(`${teamName} ajouté à vos favoris.`);
  };

  const handleRemoveFavorite = (id: number) => {
    setFavoriteTeams(favoriteTeams.filter((t) => t.id !== id));
    toast.info("Favori retiré.");
  };

  return (
    <AppShell>
      <PageTitle eyebrow="Personnel" title="Favoris & Alertes" />

      {!isPremium && (
        <div className="mx-4 mb-4 rounded-2xl bg-warn/10 p-3 ring-1 ring-warn/20 lg:mx-0">
          <div className="flex items-center justify-between text-xs font-bold text-warn">
            <span className="flex items-center gap-1.5">
              <Lock className="size-3.5" /> Plan Gratuit : {favoriteTeams.length} / 3 favoris utilisés
            </span>
            <Link to="/premium" className="inline-flex items-center gap-1 text-[11px] underline font-black text-foreground">
              Passer Premium <Crown className="size-3 text-brand" />
            </Link>
          </div>
        </div>
      )}

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto px-4 lg:px-0">
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

      <div className="space-y-3 px-4 lg:px-0">
        {tab === "teams" && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Vos Équipes Suivies ({favoriteTeams.length})
              </div>
              <button
                onClick={() => handleAddFavorite("Manchester City")}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
              >
                <Plus className="size-3.5" /> Ajouter
              </button>
            </div>

            {favoriteTeams.length === 0 ? (
              <EmptyState
                icon={<Star className="size-5 text-warn" />}
                title="Aucune équipe favorite"
                msg="Ajoutez vos équipes préférées depuis la page des matchs en direct pour les retrouver ici."
              />
            ) : (
              <div className="space-y-2">
                {favoriteTeams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between rounded-2xl bg-card p-3 ring-1 ring-black/5 dark:ring-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-warn/10 text-warn">
                        <Star className="size-4 fill-warn" />
                      </div>
                      <div>
                        <div className="text-sm font-bold">{team.name}</div>
                        <div className="text-[11px] text-muted-foreground">{team.country}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFavorite(team.id)}
                      className="grid size-8 place-items-center rounded-full bg-surface text-muted-foreground hover:text-alert ring-1 ring-black/5 dark:ring-white/10"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}

                {!isPremium && favoriteTeams.length >= 3 && (
                  <div className="mt-4 rounded-3xl bg-card p-4 text-center ring-1 ring-brand/30">
                    <Crown className="mx-auto size-6 text-brand" />
                    <div className="mt-2 text-xs font-black">Limite de 3 favoris atteinte</div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Passez à ScoreZen AI Premium pour ajouter un nombre illimité d'équipes et de compétitions.
                    </p>
                    <button
                      onClick={() => navigate({ to: "/premium" })}
                      className="mt-3 w-full rounded-2xl bg-brand py-2.5 text-xs font-black text-brand-foreground"
                    >
                      Passer Premium maintenant
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
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
