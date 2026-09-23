import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  Search,
  ShieldAlert,
  Smartphone,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import { AdminPresence } from "@/components/AdminPresence";
import {
  getAdminUserDetails,
  getAdminUsers,
  restoreAdminUser,
  suspendAdminUser,
  type AdminUser,
  type AdminUserDetails,
} from "@/lib/admin.functions";
import { isLocalDemo } from "@/lib/local-demo";

export const Route = createFileRoute("/admin/utilisateurs")({ component: AdminUsersPage });
const DEMO_USERS: { users: AdminUser[]; hasMore: boolean } = {
  users: [
    {
      id: "demo-1",
      email: "dodo@example.com",
      displayName: "Dodo",
      plan: "premium",
      credits: 84,
      accountStatus: "active",
      roles: ["owner"],
      createdAt: "2026-07-01T10:00:00Z",
      emailConfirmedAt: "2026-07-01T10:01:00Z",
      lastSignInAt: "2026-08-25T09:30:00Z",
      lastSeenAt: "2026-08-25T09:31:00Z",
      lastRoute: "/admin/utilisateurs",
      lastDeviceFamily: "desktop",
      lastActivityAt: "2026-08-25T09:31:00Z",
      premiumUntil: "2027-07-01T10:00:00Z",
      countryCode: "CM",
      countryName: "Cameroun",
      countrySource: "browser",
    },
    {
      id: "demo-2",
      email: "support@example.com",
      displayName: "Support",
      plan: "free",
      credits: 5,
      accountStatus: "suspended",
      roles: ["user"],
      createdAt: "2026-07-05T10:00:00Z",
      emailConfirmedAt: null,
      lastSignInAt: "2026-08-20T11:00:00Z",
      lastSeenAt: null,
      lastRoute: null,
      lastDeviceFamily: null,
      lastActivityAt: "2026-08-20T11:00:00Z",
      premiumUntil: null,
      countryCode: null,
      countryName: null,
      countrySource: "unknown",
    },
  ],
  hasMore: false,
};

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function relative(value: string | null | undefined) {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

function activityIcon(kind: AdminUserDetails["activity"][number]["kind"]) {
  if (kind === "account") return <Mail className="size-3.5" />;
  if (kind === "presence") return <Smartphone className="size-3.5" />;
  if (kind === "credits" || kind === "payment" || kind === "subscription")
    return <CheckCircle2 className="size-3.5" />;
  return <Activity className="size-3.5" />;
}

function AdminUsersPage() {
  const demo = isLocalDemo();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const getUsers = useServerFn(getAdminUsers);
  const getDetails = useServerFn(getAdminUserDetails);
  const suspend = useServerFn(suspendAdminUser);
  const restore = useServerFn(restoreAdminUser);
  const query = useQuery({
    queryKey: ["admin", "users", search, page],
    queryFn: () => getUsers({ data: { page, pageSize: 50, search } }),
    enabled: !demo,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
  const detailsQuery = useQuery({
    queryKey: ["admin", "user-details", selected],
    queryFn: () => getDetails({ data: { userId: selected as string } }),
    enabled: !demo && Boolean(selected),
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (demo) return;
    const channel = supabase.channel("admin-users-live");
    for (const table of ["user_presence", "profiles", "ai_analyses", "payments", "subscriptions", "community_messages"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        if (selected)
          void queryClient.invalidateQueries({ queryKey: ["admin", "user-details", selected] });
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demo, queryClient, selected]);
  const data = demo ? DEMO_USERS : query.data;
  const details = demo ? null : detailsQuery.data;
  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }
  async function mutate(userId: string, action: "suspend" | "restore") {
    if (reason.trim().length < 8) return;
    if (demo) return;
    try {
      if (action === "suspend") await suspend({ data: { userId, reason } });
      else await restore({ data: { userId, reason } });
      setReason("");
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "user-details", userId] });
    } catch {
      /* surface is kept stable; the server remains authoritative */
    }
  }
  return (
    <AdminSection
      eyebrow="Gestion des comptes"
      title="Utilisateurs"
      description="Recherchez, surveillez et modérez les comptes sans exposer de données sensibles."
    >
      <AdminPresence />
      <AdminCard>
        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Email, nom ou identifiant…"
            className="h-10 w-full rounded-xl border border-border/70 bg-background pl-9 pr-3 text-xs font-bold outline-none focus:border-brand"
          />
        </div>
        <div className="mt-4 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
          <p>
            <strong className="text-foreground">Inscription :</strong> date et heure du compte
          </p>
          <p>
            <strong className="text-foreground">Activité :</strong> connexion, présence et actions
            récentes
          </p>
          <p>
            <strong className="text-foreground">Confidentialité :</strong> réservé aux comptes
            autorisés
          </p>
        </div>
      </AdminCard>
      {!demo && query.isLoading ? (
        <AdminLoading />
      ) : (
        <AdminCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="border-b border-border/60 bg-surface">
              <tr>
                {[
                  "Utilisateur / inscription",
                  "Activité",
                  "Plan / crédits",
                  "Rôle",
                  "État",
                  "Actions",
                ].map((label) => (
                  <th key={label} className="p-3 font-black">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(data?.users ?? []).map((user) => (
                <tr key={user.id}>
                  <td className="p-3">
                    <p className="font-black">{user.displayName ?? "Sans nom"}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {user.email ?? user.id}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CalendarDays className="size-3" /> Inscrit le {dateTime(user.createdAt)}
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-brand">
                      {user.countryName ?? "Pays non renseigné"}
                      {user.countryCode ? ` (${user.countryCode})` : ""}
                    </p>
                  </td>
                  <td className="p-3">
                    <p className="flex items-center gap-1 font-bold">
                      <Clock3 className="size-3 text-brand" /> {relative(user.lastActivityAt)}
                    </p>
                    <p className="mt-1 max-w-[180px] truncate text-[10px] text-muted-foreground">
                      {user.lastRoute ?? "Aucune présence récente"}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {user.lastDeviceFamily ?? "—"} · connexion {relative(user.lastSignInAt)}
                    </p>
                  </td>
                  <td className="p-3">
                    <p className="font-bold">{user.plan === "premium" ? "Premium" : "Gratuit"}</p>
                    <p className="mt-1 font-black text-brand">{user.credits} crédits</p>
                  </td>
                  <td className="p-3">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="mr-1 rounded-full bg-surface px-2 py-1 text-[10px] font-black"
                      >
                        {role}
                      </span>
                    ))}
                  </td>
                  <td className="p-3">
                    <span className={user.accountStatus === "active" ? "text-brand" : "text-alert"}>
                      {user.accountStatus === "active" ? "Actif" : "Suspendu"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex min-w-[300px] flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelected(user.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand px-2 py-2 text-[10px] font-black text-brand-foreground"
                      >
                        Voir le détail
                      </button>
                      {selected === user.id ? (
                        <>
                          <input
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Motif obligatoire"
                            className="h-8 min-w-[150px] flex-1 rounded-lg border border-border bg-background px-2 text-[10px] text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              void mutate(
                                user.id,
                                user.accountStatus === "active" ? "suspend" : "restore",
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-foreground px-2 py-2 text-[10px] font-black text-background"
                          >
                            {user.accountStatus === "active" ? (
                              <UserX className="size-3" />
                            ) : (
                              <UserCheck className="size-3" />
                            )}{" "}
                            Confirmer
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelected(user.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-[10px] font-black text-foreground transition-colors hover:bg-surface"
                        >
                          {user.accountStatus === "active" ? (
                            <>
                              <UserX className="size-3" /> Suspendre
                            </>
                          ) : (
                            <>
                              <UserCheck className="size-3" /> Réactiver
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-surface p-3">
            <p className="text-[10px] font-bold text-muted-foreground">
              Page {page} · {data?.users.length ?? 0} compte(s) affiché(s)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-border bg-card px-3 py-2 text-[10px] font-black text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                type="button"
                disabled={!data?.hasMore}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg bg-foreground px-3 py-2 text-[10px] font-black text-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        </AdminCard>
      )}
      {selected && (
        <AdminCard className="border-brand/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand">
                Fiche utilisateur complète
              </p>
              <h2 className="mt-1 text-lg font-black">
                {details?.user.displayName ??
                  data?.users.find((item) => item.id === selected)?.displayName ??
                  "Utilisateur"}
              </h2>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="size-3.5" />{" "}
                {details?.user.email ??
                  data?.users.find((item) => item.id === selected)?.email ??
                  selected}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-black text-foreground"
            >
              <X className="size-3.5" /> Fermer
            </button>
          </div>
          {!demo && detailsQuery.isLoading ? (
            <div className="mt-5">
              <AdminLoading />
            </div>
          ) : details ? (
            <>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Inscription", dateTime(details.user.createdAt)],
                  [
                    "Dernière connexion",
                    details.user.lastSignInAt ? dateTime(details.user.lastSignInAt) : "Jamais",
                  ],
                  [
                    "Dernière activité",
                    details.user.lastActivityAt
                      ? `${relative(details.user.lastActivityAt)} · ${dateTime(details.user.lastActivityAt)}`
                      : "Aucune",
                  ],
                  ["Email", details.user.emailVerified ? "Confirmé" : "Non confirmé"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-surface p-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 text-xs font-black">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Plan", details.user.plan === "premium" ? "Premium" : "Gratuit"],
                  ["Crédits", `${details.user.credits}`],
                  [
                    "Présence",
                    details.user.lastSeenAt
                      ? `${relative(details.user.lastSeenAt)} · ${details.user.lastDeviceFamily ?? "—"}`
                      : "Hors ligne",
                  ],
                  ["Rôle", details.user.roles.join(" · ") || "user"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-card p-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 truncate text-xs font-black">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(details.counts).map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-black text-foreground"
                  >
                    {value} · {key.replace(/([A-Z])/g, " $1")}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2">
                <Activity className="size-4 text-brand" />
                <h3 className="text-sm font-black">Chronologie des actions</h3>
                <span className="text-[10px] text-muted-foreground">
                  {details.activity.length} événement(s) récent(s)
                </span>
              </div>
              <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {details.activity.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 rounded-xl border border-border/60 bg-surface p-3"
                  >
                    <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                      {activityIcon(item.kind)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-xs font-black">{item.label}</p>
                        <time className="text-[10px] text-muted-foreground">
                          {dateTime(item.at)}
                        </time>
                      </div>
                      {item.detail && (
                        <p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
                {!details.activity.length && (
                  <p className="rounded-xl bg-surface p-6 text-center text-xs font-bold text-muted-foreground">
                    Aucune action enregistrée pour ce compte.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-xl bg-surface p-5 text-center text-xs font-bold text-muted-foreground">
              Les détails de ce compte ne sont pas disponibles.
            </p>
          )}
        </AdminCard>
      )}
      {selected && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="size-4 text-warn" /> Toute suspension est réversible et
          enregistrée dans l’audit.
        </p>
      )}
    </AdminSection>
  );
}
