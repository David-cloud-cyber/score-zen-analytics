import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Globe2, Ticket } from "lucide-react";
import { AdminEditorialPanel } from "@/components/AdminEditorialPanel";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import { getAdminContent } from "@/lib/admin.functions";
import { isLocalDemo } from "@/lib/local-demo";

export const Route = createFileRoute("/admin/contenus")({ component: AdminContentPage });

function AdminContentPage() {
  const demo = isLocalDemo();
  const getContent = useServerFn(getAdminContent);
  const query = useQuery({
    queryKey: ["admin", "content"],
    queryFn: () => getContent(),
    enabled: !demo,
    staleTime: 300_000,
  });
  const data = demo
    ? {
        bookmakers: [{ slug: "betwinner", name: "Betwinner", code: "BALL10", countries: ["cameroun"], updatedAt: "2026-08-01" }],
        countries: [{ slug: "cameroun", name: "Cameroun" }],
      }
    : query.data;
  if (!demo && query.isLoading) return <AdminLoading />;
  return (
    <AdminSection eyebrow="Éditorial & partenaires" title="Contenus" description="Contrôlez les partenaires, codes promo, pays et articles présents dans le SaaS.">
      <AdminEditorialPanel />
      <div className="grid gap-4 xl:grid-cols-2">
        <AdminCard>
          <div className="flex items-center gap-2"><Ticket className="size-4 text-brand" /><p className="text-sm font-black">Partenaires bookmaker</p></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(data?.bookmakers ?? []).map((bookmaker) => <div key={bookmaker.slug} className="rounded-xl bg-surface p-3"><p className="text-sm font-black">{bookmaker.name}</p><p className="mt-1 text-xs text-brand">Code : {bookmaker.code}</p><p className="mt-1 text-[10px] text-muted-foreground">Mis à jour le {bookmaker.updatedAt}</p></div>)}
          </div>
        </AdminCard>
        <AdminCard>
          <div className="flex items-center gap-2"><Globe2 className="size-4 text-brand" /><p className="text-sm font-black">Pays SEO actifs</p></div>
          <div className="mt-4 flex flex-wrap gap-2">{(data?.countries ?? []).map((country) => <span key={country.slug} className="rounded-full bg-surface px-3 py-2 text-xs font-bold">{country.name}</span>)}</div>
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="size-4" /> Les contenus et articles sont contrôlés depuis cette file éditoriale.</div>
        </AdminCard>
      </div>
    </AdminSection>
  );
}
