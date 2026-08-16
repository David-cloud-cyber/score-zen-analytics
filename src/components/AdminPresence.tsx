import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Monitor, Smartphone, Tablet, Users } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminOnlineUsers, type AdminOnlineUser } from "@/lib/presence.functions";
import { isLocalDemo } from "@/lib/local-demo";
import { AdminCard } from "@/components/AdminShell";

const DEMO_PRESENCE = {
  count: 2,
  users: [
    {
      id: "demo-1",
      displayName: "Dodo",
      plan: "premium",
      lastSeenAt: new Date().toISOString(),
      route: "/premium/tableau-de-bord",
      deviceFamily: "desktop" as const,
    },
    {
      id: "demo-2",
      displayName: "Fan LiveFoot",
      plan: "free",
      lastSeenAt: new Date().toISOString(),
      route: "/",
      deviceFamily: "mobile" as const,
    },
  ],
  generatedAt: new Date().toISOString(),
};

function DeviceIcon({ device }: { device: AdminOnlineUser["deviceFamily"] }) {
  if (device === "mobile") return <Smartphone className="size-4" />;
  if (device === "tablet") return <Tablet className="size-4" />;
  return <Monitor className="size-4" />;
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 10) return "à l’instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  return `il y a ${Math.round(seconds / 60)} min`;
}

export function AdminPresence() {
  const demo = isLocalDemo();
  const queryClient = useQueryClient();
  const getPresence = useServerFn(getAdminOnlineUsers);
  const query = useQuery({
    queryKey: ["admin", "online-users"],
    queryFn: () => getPresence(),
    enabled: !demo,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
  const data = demo ? DEMO_PRESENCE : query.data;

  useEffect(() => {
    if (demo) return;
    const channel = supabase
      .channel("admin-user-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "online-users"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demo, queryClient]);

  return (
    <AdminCard className="overflow-hidden">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-brand" />
        <p className="text-sm font-black">Utilisateurs en ligne</p>
        <span className="ml-auto rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-black text-brand">
          {data?.count ?? "—"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Présence actualisée automatiquement.</p>
      {!data ? (
        <div
          className="lf-loading-skeleton mt-4 h-16 rounded-xl"
          aria-label="Chargement en cours"
        />
      ) : data.users.length === 0 ? (
        <p className="mt-4 rounded-xl bg-surface p-4 text-center text-xs font-bold text-muted-foreground">
          Aucun utilisateur en ligne actuellement.
        </p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {data.users.slice(0, 12).map((user) => (
            <div
              key={user.id}
              className="flex min-w-0 items-center gap-3 rounded-xl bg-surface p-3"
            >
              <span
                className="size-2 shrink-0 rounded-full bg-brand shadow-[0_0_0_3px_rgb(35_216_145_/_15%)]"
                aria-label="En ligne"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black">{user.displayName}</p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                  {user.plan === "premium" ? "Premium" : "Gratuit"} ·{" "}
                  {relativeTime(user.lastSeenAt)}
                </p>
              </div>
              <DeviceIcon device={user.deviceFamily} />
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
}
