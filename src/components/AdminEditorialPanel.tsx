import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Check, Play, X } from "lucide-react";
import { AdminCard } from "@/components/AdminShell";
import { isLocalDemo } from "@/lib/local-demo";
import { getAdminEditorialQueue, runAdminEditorialCycle, setAdminEditorialStatus } from "@/lib/editorial.functions";

type AdminEditorialArticle = {
  id: string;
  title: string;
  status: string;
  quality_score: number | null;
  word_count: number;
};

export function AdminEditorialPanel() {
  const demo = isLocalDemo();
  const queryClient = useQueryClient();
  const getQueue = useServerFn(getAdminEditorialQueue);
  const runCycle = useServerFn(runAdminEditorialCycle);
  const updateStatus = useServerFn(setAdminEditorialStatus);
  const query = useQuery({ queryKey: ["admin", "editorial"], queryFn: () => getQueue(), enabled: !demo, staleTime: 30_000 });
  const cycle = useMutation({ mutationFn: () => runCycle(), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "editorial"] }) });
  const status = useMutation({ mutationFn: (input: { articleId: string; status: "published" | "rejected" }) => updateStatus({ data: input }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "editorial"] }) });
  const data = demo ? { articles: [], topics: [], runs: [] } : query.data;
  return (
    <div className="space-y-4">
      <AdminCard>
        <div className="flex flex-wrap items-center gap-3"><Bot className="size-4 text-brand" /><div><p className="text-sm font-black">File éditoriale</p><p className="mt-1 text-xs text-muted-foreground">Sujets détectés, contrôles de qualité et publications du blog.</p></div><button type="button" onClick={() => cycle.mutate()} disabled={cycle.isPending || demo} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand px-3 py-2 text-xs font-black text-brand-foreground disabled:cursor-not-allowed disabled:opacity-60"><Play className="size-3.5" />{cycle.isPending ? "Préparation…" : "Lancer une sélection"}</button></div>
        {cycle.isError && <p className="mt-3 text-xs font-bold text-alert">La sélection n’a pas pu être lancée.</p>}
      </AdminCard>
      <AdminCard>
        <div className="flex items-center justify-between"><div><p className="text-sm font-black">Articles récents</p><p className="mt-1 text-xs text-muted-foreground">Un article n’est public qu’après les contrôles éditoriaux.</p></div><span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-black text-brand">{data?.articles.length ?? 0}</span></div>
        {!data?.articles.length ? <p className="mt-4 rounded-xl bg-surface p-4 text-center text-xs font-bold text-muted-foreground">Aucun article éditorial enregistré.</p> : <div className="mt-4 space-y-2">{(data.articles as AdminEditorialArticle[]).slice(0, 8).map((article: AdminEditorialArticle) => <div key={article.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{article.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{article.status} · score {article.quality_score ?? "—"} · {article.word_count} mots</p></div>{article.status === "validated" && <><button type="button" onClick={() => status.mutate({ articleId: article.id, status: "published" })} disabled={status.isPending} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-2 text-[10px] font-black text-brand-foreground"><Check className="size-3" />Publier</button><button type="button" onClick={() => status.mutate({ articleId: article.id, status: "rejected" })} disabled={status.isPending} className="inline-flex items-center gap-1 rounded-lg bg-alert px-2.5 py-2 text-[10px] font-black text-white"><X className="size-3" />Bloquer</button></>}</div>)}</div>}
      </AdminCard>
    </div>
  );
}
