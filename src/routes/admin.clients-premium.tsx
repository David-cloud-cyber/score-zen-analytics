import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrainCircuit, Crown, Search, Target, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import { getAdminPayingUsers } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/clients-premium")({ component: AdminPayingUsersPage });

function formatDate(value: string | null) {
  if (!value) return "Sans échéance";
  return new Date(value).toLocaleDateString("fr-FR", { dateStyle: "medium" });
}

function AdminPayingUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const load = useServerFn(getAdminPayingUsers);
  const query = useQuery({
    queryKey: ["admin", "paying-users", search, page],
    queryFn: () => load({ data: { page, pageSize: 50, search } }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    const channel = supabase.channel("admin-paying-users-live");
    for (const table of ["user_presence", "profiles", "ai_analyses", "payments", "subscriptions"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "paying-users"] });
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
  const users = query.data?.users ?? [];
  const totalAnalyses = users.reduce((sum, user) => sum + user.analyses, 0);
  const settled = users.reduce((sum, user) => sum + user.settled, 0);
  const won = users.reduce((sum, user) => sum + user.won, 0);

  return (
    <AdminSection
      eyebrow="Abonnements actifs"
      title="Clients payants"
      description="Activité et performance des pronostics IA, réservées à l’administration. Les abstentions et répétitions ne sont pas comptées comme des succès."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Users className="size-4" />} label="Clients affichés" value={users.length} />
        <Metric
          icon={<BrainCircuit className="size-4" />}
          label="Analyses lancées"
          value={totalAnalyses}
        />
        <Metric icon={<Target className="size-4" />} label="Pronostics réglés" value={settled} />
        <Metric
          icon={<Crown className="size-4" />}
          label="Réussite agrégée"
          value={settled ? `${Math.round((won / settled) * 1000) / 10}%` : "—"}
        />
      </div>
      <AdminCard>
        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Rechercher par nom ou email…"
            className="h-10 w-full rounded-xl border border-border/70 bg-background pl-9 pr-3 text-xs font-bold text-foreground outline-none focus:border-brand"
          />
        </div>
      </AdminCard>
      {query.isLoading ? (
        <AdminLoading />
      ) : (
        <AdminCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="border-b border-border/60 bg-surface">
              <tr>
                {[
                  "Client",
                  "Accès",
                  "Activité",
                  "Zone",
                  "Analyses",
                  "IA",
                  "Performance",
                  "Qualité",
                ].map((label) => (
                  <th key={label} className="p-3 font-black">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="p-3">
                    <p className="font-black">{user.displayName ?? "Sans nom"}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {user.email ?? user.id}
                    </p>
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-brand/10 px-2 py-1 font-black text-brand">
                      Premium
                    </span>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      jusqu’au {formatDate(user.premiumUntil)}
                    </p>
                    <p className="mt-1 font-bold">{user.credits} crédits</p>
                  </td>
                  <td className="p-3">
                    <p className="font-bold">{formatDate(user.lastActivityAt)}</p>
                    <p className="mt-1 max-w-[170px] truncate text-[10px] text-muted-foreground">
                      {user.lastRoute ?? "Aucune route récente"}
                    </p>
                  </td>
                  <td className="p-3">
                    <p className="font-bold">{user.countryName}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {user.countryCode ?? "Non renseigné"}
                    </p>
                  </td>
                  <td className="p-3">
                    <strong>{user.analyses}</strong>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      dernière : {formatDate(user.lastAnalysisAt)}
                    </p>
                  </td>
                  <td className="p-3">
                    <strong>{user.aiEnriched}</strong>
                    <p className="mt-1 text-[10px] text-muted-foreground">analyse(s) enrichie(s)</p>
                  </td>
                  <td className="p-3">
                    <strong
                      className={
                        user.hitRate !== null && user.hitRate >= 70
                          ? "text-brand"
                          : "text-foreground"
                      }
                    >
                      {user.hitRate === null ? "—" : `${user.hitRate}%`}
                    </strong>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {user.won}/{user.settled} gagnés · {user.lost} perdus
                    </p>
                  </td>
                  <td className="p-3">
                    <strong>
                      {user.averageDataQuality === null ? "—" : `${user.averageDataQuality}%`}
                    </strong>
                    <p className="mt-1 text-[10px] text-muted-foreground">contexte moyen</p>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Aucun client payant ne correspond à cette recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex justify-end gap-2 border-t border-border/60 p-3">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-[10px] font-black text-foreground disabled:opacity-50"
            >
              Précédent
            </button>
            <button
              type="button"
              disabled={!query.data?.hasMore}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg bg-brand px-3 py-2 text-[10px] font-black text-brand-foreground disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </AdminCard>
      )}
    </AdminSection>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <AdminCard>
      <div className="flex items-center gap-2 text-brand">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2 text-xl font-black">{value}</p>
    </AdminCard>
  );
}
