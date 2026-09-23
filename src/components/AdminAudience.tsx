import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Globe2, Monitor, Smartphone, Tablet, Users } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAudience, type AdminAudience } from "@/lib/admin.functions";
import { isLocalDemo } from "@/lib/local-demo";
import { AdminCard } from "@/components/AdminShell";

const DEMO_AUDIENCE: AdminAudience = {
  totals: { users: 1284, active24h: 947, online: 18, premium: 156, unknownCountry: 91 },
  countries: [
    { code: "CM", name: "Cameroun", users: 640, online: 9 },
    { code: "CI", name: "Côte d’Ivoire", users: 280, online: 4 },
    { code: "SN", name: "Sénégal", users: 180, online: 3 },
    { code: null, name: "Non renseigné", users: 91, online: 1 },
  ],
  devices: [
    { device: "mobile", users: 940, online: 14 },
    { device: "desktop", users: 250, online: 3 },
    { device: "tablet", users: 94, online: 1 },
  ],
  routes: [
    { route: "/", online: 8 },
    { route: "/pronostics-du-jour", online: 5 },
    { route: "/analyse", online: 3 },
  ],
  activity24h: { analyses: 148, payments: 12, communityMessages: 86 },
  generatedAt: new Date().toISOString(),
};

function DeviceIcon({ device }: { device: AdminAudience["devices"][number]["device"] }) {
  if (device === "mobile") return <Smartphone className="size-3.5" />;
  if (device === "tablet") return <Tablet className="size-3.5" />;
  return <Monitor className="size-3.5" />;
}

export function AdminAudience() {
  const demo = isLocalDemo();
  const queryClient = useQueryClient();
  const load = useServerFn(getAdminAudience);
  const query = useQuery({
    queryKey: ["admin", "audience"],
    queryFn: () => load(),
    enabled: !demo,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
  const data = demo ? DEMO_AUDIENCE : query.data;

  useEffect(() => {
    if (demo) return;
    const channel = supabase.channel("admin-audience-live");
    for (const table of ["user_presence", "profiles", "ai_analyses", "payments", "community_messages"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "audience"] });
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demo, queryClient]);

  if (!data)
    return (
      <div className="lf-loading-skeleton h-64 rounded-2xl" aria-label="Chargement en cours" />
    );

  return (
    <AdminCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 className="size-4 text-brand" />
            <h2 className="text-sm font-black">Audience & activité</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Synchronisé toutes les 15 secondes et à chaque présence détectée.
          </p>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground">
          {new Date(data.generatedAt).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Comptes actifs", data.totals.users.toLocaleString("fr-FR")],
          ["En ligne", data.totals.online.toLocaleString("fr-FR")],
          ["Actifs sur 24 h", data.totals.active24h.toLocaleString("fr-FR")],
          ["Premium", data.totals.premium.toLocaleString("fr-FR")],
          [
            "Pays renseigné",
            `${Math.max(0, data.totals.users - data.totals.unknownCountry).toLocaleString("fr-FR")}`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-brand" />
            <p className="text-xs font-black">Pays / zones détectés</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.countries.map((country) => (
              <div
                key={country.code ?? "unknown"}
                className="flex items-center justify-between rounded-xl border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-black">{country.name}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {country.users} compte(s)
                  </p>
                </div>
                <span className="rounded-full bg-brand/10 px-2 py-1 text-[10px] font-black text-brand">
                  {country.online} en ligne
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Pays estimé via la région de langue du navigateur ou le profil, jamais via GPS. « Non
            renseigné » reste normal.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-brand" />
              <p className="text-xs font-black">Appareils actifs</p>
            </div>
            <div className="mt-3 space-y-2">
              {data.devices.map((item) => (
                <div
                  key={item.device}
                  className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-2 font-bold">
                    <DeviceIcon device={item.device} />
                    {item.device}
                  </span>
                  <span className="text-muted-foreground">
                    {item.users} · <strong className="text-foreground">{item.online} live</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-black">Activité des dernières 24 h</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Analyses", data.activity24h.analyses],
                ["Paiements", data.activity24h.payments],
                ["Messages", data.activity24h.communityMessages],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/60 p-2">
                  <p className="text-sm font-black">{value}</p>
                  <p className="mt-1 text-[9px] font-bold text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-black">Routes actuellement actives</p>
            <div className="mt-3 space-y-2">
              {data.routes.length ? (
                data.routes.map((item) => (
                  <div
                    key={item.route}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate font-bold">{item.route}</span>
                    <span className="shrink-0 font-black text-brand">{item.online} en ligne</span>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-muted-foreground">Aucune présence active.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminCard>
  );
}
