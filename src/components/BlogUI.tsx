import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bookmark, CalendarDays, CheckCircle2, ExternalLink, FileText, Flag, Link as LinkIcon, MessageCircle, Send, Share2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/use-session";
import { isLocalDemo } from "@/lib/local-demo";
import { getEditorialComments, getMyEditorialState, postEditorialComment, reportEditorialComment, saveEditorialProgress, toggleEditorialFavorite, toggleEditorialReaction } from "@/lib/editorial.functions";
import type { EditorialCategory, EditorialComment, EditorialListItem, PublicEditorialArticle } from "@/lib/editorial.types";
import { TelegramCtaCard } from "@/components/TelegramCtaCard";

export const BLOG_CATEGORY_LABELS: Record<EditorialCategory, string> = {
  actualites: "Actualités football",
  competitions: "Compétitions",
  forme: "Forme et effectifs",
  analyse: "Analyse statistique",
  guides: "Guides football",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function coverFor(category: EditorialCategory) {
  return { actualites: "/images/blog/cover-football.png", competitions: "/images/blog/cover-competitions.png", forme: "/images/blog/cover-forme.png", analyse: "/images/blog/cover-analysis.png", guides: "/images/blog/cover-guides.png" }[category];
}

export function BlogCard({ article }: { article: EditorialListItem }) {
  return <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-transform hover:-translate-y-0.5">
    <img src={article.coverImage ?? coverFor(article.category)} alt={article.coverAlt ?? article.title} width={1200} height={630} loading="lazy" decoding="async" className="aspect-[1200/630] w-full object-cover" />
    <div className="flex flex-1 flex-col p-5">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand"><FileText className="size-3.5" aria-hidden />{BLOG_CATEGORY_LABELS[article.category]}</div>
      <h2 className="mt-3 text-lg font-black leading-tight tracking-tight">{article.title}</h2>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{article.excerpt}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden />{formatDate(article.publishedAt)}</span><span>{article.readingTimeMinutes} min</span><Link to="/blog/$slug" params={{ slug: article.slug }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 font-black text-brand-foreground">Lire<ArrowRight className="size-3.5" aria-hidden /></Link></div>
    </div>
  </article>;
}

export function BlogIndexEmpty() {
  return <div className="rounded-2xl border border-border/70 bg-card p-8 text-center"><FileText className="mx-auto size-8 text-brand" aria-hidden /><h2 className="mt-3 text-lg font-black">Les prochains articles arrivent bientôt</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">La rédaction prépare des contenus football vérifiés, avec leurs sources et des analyses utiles.</p></div>;
}

type BlogIndexData = {
  articles: EditorialListItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  total?: number;
};

export function BlogListingPage({ data, basePath, title, description, activeCategory }: { data: BlogIndexData; basePath: string; title: string; description: string; activeCategory?: string }) {
  const categories = Object.entries(BLOG_CATEGORY_LABELS);
  const featured = data.articles[0];
  const buildPage = (page: number) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (activeCategory) params.set("category", activeCategory);
    return `${basePath}?${params.toString()}`;
  };
  return <AppShell><section className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-8 lg:px-0">
    <header className="max-w-3xl space-y-3"><p className="text-[10px] font-black uppercase tracking-widest text-brand">La rédaction LiveFoot</p><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1><p className="text-base leading-relaxed text-muted-foreground">{description}</p></header>
    <form method="get" action={basePath} className="grid gap-3 rounded-2xl border border-border/70 bg-surface p-4 md:grid-cols-[minmax(0,1fr)_180px_150px_auto]"><label className="sr-only" htmlFor="blog-query">Rechercher un article</label><input id="blog-query" name="q" type="search" defaultValue={typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") ?? "" : ""} placeholder="Rechercher une équipe, une compétition…" className="h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand" /><select name="category" defaultValue={activeCategory ?? ""} className="h-11 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"><option value="">Toutes les catégories</option>{categories.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}</select><select name="sort" defaultValue="newest" className="h-11 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"><option value="newest">Plus récents</option><option value="useful">Plus utiles</option></select><button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-xs font-black text-brand-foreground">Rechercher</button></form>
    <nav aria-label="Catégories du blog" className="flex gap-2 overflow-x-auto pb-1">{[["/blog", "Tous les articles"], ...categories.map(([slug, label]) => [`/blog/categorie/${slug}`, label] as const)].map(([href, label]) => <a key={href} href={href} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${href.endsWith(activeCategory ?? "__none__") ? "border-brand bg-brand text-brand-foreground" : "border-border/70 bg-card text-muted-foreground hover:text-foreground"}`}>{label}</a>)}</nav>
    {featured ? <section aria-labelledby="featured-article" className="grid gap-5 rounded-2xl border border-brand/25 bg-brand/5 p-4 md:grid-cols-[1.15fr_1fr] md:p-5"><div><img src={featured.coverImage ?? coverFor(featured.category)} alt={featured.coverAlt ?? featured.title} width={1200} height={630} loading="eager" className="aspect-[1200/630] w-full rounded-xl object-cover" /></div><div className="flex flex-col justify-center"><p className="text-[10px] font-black uppercase tracking-widest text-brand">À la une</p><h2 id="featured-article" className="mt-2 text-2xl font-black leading-tight">{featured.title}</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{featured.excerpt}</p><Link to="/blog/$slug" params={{ slug: featured.slug }} className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-brand px-4 py-3 text-xs font-black text-brand-foreground">Lire l’article<ArrowRight className="size-4" /></Link></div></section> : null}
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-brand">{data.total ?? data.articles.length} articles</p><h2 className="mt-1 text-2xl font-black tracking-tight">Derniers articles</h2></div><p className="text-xs text-muted-foreground">Des contenus vérifiés, mis à jour au fil des sources.</p></div>
    {data.articles.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.articles.slice(1).map((article) => <BlogCard key={article.id} article={article} />)}</div> : <BlogIndexEmpty />}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5"><span className="text-xs text-muted-foreground">Page {data.page}</span><div className="flex gap-2">{data.page > 1 ? <a href={buildPage(data.page - 1)} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground">Précédent</a> : null}{data.hasMore ? <a href={buildPage(data.page + 1)} className="rounded-xl bg-brand px-3 py-2 text-xs font-black text-brand-foreground">Suivant</a> : null}</div></div>
    <TelegramCtaCard location={basePath === "/blog/football" ? "blog_football" : "blog_index"} compact />
  </section></AppShell>;
}

function ArticleActions({ articleId, title }: { articleId: string; title: string }) {
  const { session } = useSession();
  const demo = isLocalDemo();
  const queryClient = useQueryClient();
  const getState = useServerFn(getMyEditorialState);
  const favorite = useServerFn(toggleEditorialFavorite);
  const state = useQuery({ queryKey: ["editorial-state", articleId], queryFn: () => getState({ data: { articleId } }), enabled: Boolean(session) && !demo, staleTime: 60_000 });
  const mutation = useMutation({ mutationFn: () => favorite({ data: { articleId } }), onSuccess: (result) => queryClient.setQueryData(["editorial-state", articleId], (current: any) => ({ ...(current ?? {}), isFavorite: result.isFavorite })) });
  const [message, setMessage] = useState("");
  async function share() { const url = window.location.href; try { if (navigator.share) await navigator.share({ title, url }); else { await navigator.clipboard.writeText(url); setMessage("Lien copié"); } } catch { /* annulation du partage */ } }
  return <div className="flex flex-wrap items-center gap-2" aria-label="Actions de l’article">
    {session && !demo ? <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-black text-foreground hover:border-brand/50 disabled:opacity-60"><Bookmark className={`size-4 ${state.data?.isFavorite ? "fill-brand text-brand" : ""}`} aria-hidden />{state.data?.isFavorite ? "Enregistré" : "Favori"}</button> : null}
    <button type="button" onClick={() => void share()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-black text-foreground hover:border-brand/50"><Share2 className="size-4" aria-hidden />Partager</button>
    <button type="button" onClick={() => void navigator.clipboard.writeText(window.location.href).then(() => setMessage("Lien copié"))} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-black text-foreground hover:border-brand/50"><LinkIcon className="size-4" aria-hidden />Copier le lien</button>
    {message ? <span className="text-xs font-bold text-brand" role="status">{message}</span> : null}
  </div>;
}

function CommentItem({ comment, onReply }: { comment: EditorialComment; onReply: (comment: EditorialComment) => void }) {
  const reactionFn = useServerFn(toggleEditorialReaction);
  const reportFn = useServerFn(reportEditorialComment);
  const [reactions, setReactions] = useState(comment.reactions);
  const [reported, setReported] = useState(false);
  const react = useMutation({ mutationFn: (reaction: "👍" | "❤️" | "🔥" | "⚽" | "👏") => reactionFn({ data: { commentId: comment.id, reaction } }), onSuccess: (result) => setReactions(result.reactions) });
  const report = useMutation({ mutationFn: () => reportFn({ data: { commentId: comment.id, reason: "Contenu à vérifier" } }), onSuccess: () => setReported(true) });
  return <div className="rounded-2xl border border-border/70 bg-card p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black">{comment.authorName}</p><time className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString("fr-FR")}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{comment.body}</p><div className="mt-3 flex flex-wrap items-center gap-1.5">{(["👍", "❤️", "🔥", "⚽", "👏"] as const).map((reaction) => <button key={reaction} type="button" onClick={() => react.mutate(reaction)} disabled={react.isPending} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground hover:border-brand/50">{reaction} {reactions[reaction] ?? ""}</button>)}<button type="button" onClick={() => onReply(comment)} className="inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-1 text-[11px] font-bold text-foreground hover:bg-brand/10"><MessageCircle className="size-3" />Répondre</button><button type="button" onClick={() => report.mutate()} disabled={reported || report.isPending} className="inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"><Flag className="size-3" />{reported ? "Signalé" : "Signaler"}</button></div></div>;
}

function EditorialComments({ articleId }: { articleId: string }) {
  const { session } = useSession();
  const demo = isLocalDemo();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<EditorialComment | null>(null);
  const getComments = useServerFn(getEditorialComments);
  const post = useServerFn(postEditorialComment);
  const query = useQuery({ queryKey: ["editorial-comments", articleId], queryFn: () => getComments({ data: { articleId, page: 1 } }), enabled: !demo, staleTime: 30_000 });
  const mutation = useMutation({ mutationFn: () => post({ data: { articleId, parentId: replyTo?.id ?? null, content } }), onSuccess: () => { setContent(""); setReplyTo(null); } });
  const comments = query.data?.comments ?? [];
  const roots = useMemo(() => comments.filter((comment) => !comment.parentId), [comments]);
  const replies = useMemo(() => comments.filter((comment) => Boolean(comment.parentId)), [comments]);
  return <section aria-labelledby="comments-title" className="space-y-4 border-t border-border/70 pt-8"><div className="flex items-center gap-2"><MessageCircle className="size-5 text-brand" aria-hidden /><h2 id="comments-title" className="text-2xl font-black tracking-tight">Discussion</h2></div><p className="text-sm leading-relaxed text-muted-foreground">Partagez un point de vue utile et respectueux. Les nouveaux messages sont vérifiés avant publication.</p>{session && !demo ? <form onSubmit={(event) => { event.preventDefault(); if (content.trim()) mutation.mutate(); }} className="rounded-2xl border border-border/70 bg-surface p-4">{replyTo ? <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-brand/10 px-3 py-2 text-xs text-brand"><span>Réponse à {replyTo.authorName}</span><button type="button" className="rounded-lg bg-surface px-2 py-1 font-black text-brand" onClick={() => setReplyTo(null)}>Annuler</button></div> : null}<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={1200} rows={3} placeholder="Votre commentaire…" className="w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-muted-foreground">{content.length}/1200</span><button type="submit" disabled={!content.trim() || mutation.isPending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-black text-brand-foreground disabled:cursor-not-allowed disabled:opacity-50"><Send className="size-4" />{mutation.isPending ? "Envoi…" : "Publier"}</button></div>{mutation.data?.message ? <p className="mt-2 text-xs font-bold text-brand" role="status">{mutation.data.message}</p> : null}</form> : <div className="rounded-2xl border border-brand/25 bg-brand/5 p-4 text-sm text-muted-foreground"><Link to="/auth" className="font-black text-brand hover:underline">Connectez-vous</Link> pour commenter et répondre.</div>}<div className="space-y-3">{roots.map((comment) => <div key={comment.id} className="space-y-2"><CommentItem comment={comment} onReply={setReplyTo} />{replies.filter((reply) => reply.parentId === comment.id).map((reply) => <div key={reply.id} className="ml-5 border-l-2 border-brand/20 pl-3"><CommentItem comment={reply} onReply={setReplyTo} /></div>)}</div>)}{!query.isLoading && !roots.length ? <p className="rounded-2xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">Aucun commentaire pour le moment. Soyez le premier à lancer la discussion.</p> : null}</div></section>;
}

export function BlogArticleView({ article }: { article: PublicEditorialArticle }) {
  const { session } = useSession();
  const demo = isLocalDemo();
  const saveProgress = useServerFn(saveEditorialProgress);
  const [reading, setReading] = useState(0);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    const update = () => { const max = document.documentElement.scrollHeight - window.innerHeight; const percent = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0; setReading(percent); if (session && !demo && saveTimer.current === null) saveTimer.current = window.setTimeout(() => { saveTimer.current = null; void saveProgress({ data: { articleId: article.id, position: Math.round(window.scrollY), percent } }).catch(() => {}); }, 1200); };
    update(); window.addEventListener("scroll", update, { passive: true }); return () => { window.removeEventListener("scroll", update); if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [article.id, demo, saveProgress, session]);
  const related = article.relatedArticles ?? [];
  return <AppShell><div className="fixed inset-x-0 top-0 z-50 h-1 bg-transparent" aria-hidden><div className="h-full bg-brand transition-[width] duration-150" style={{ width: `${reading}%` }} /></div><article className="mx-auto max-w-5xl px-4 pb-16 pt-8 lg:px-0"><nav aria-label="Fil d’Ariane" className="mb-6 text-xs text-muted-foreground"><a href="/" className="hover:text-brand">Accueil</a><span className="mx-2">/</span><a href="/blog" className="hover:text-brand">Blog</a><span className="mx-2">/</span><span className="text-foreground">{BLOG_CATEGORY_LABELS[article.category]}</span></nav><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]"><div className="min-w-0 space-y-8"><header className="space-y-5"><div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand"><span>{BLOG_CATEGORY_LABELS[article.category]}</span><span className="text-muted-foreground">·</span><span className="text-muted-foreground">Publié le {formatDate(article.publishedAt)}</span><span className="text-muted-foreground">·</span><span className="text-muted-foreground">Mis à jour le {formatDate(article.updatedAt)}</span></div><h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">{article.title}</h1><p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{article.excerpt}</p><img src={article.coverImage ?? coverFor(article.category)} alt={article.coverAlt ?? article.title} width={1200} height={630} loading="eager" decoding="async" className="aspect-[1200/630] w-full rounded-2xl border border-border/70 object-cover" /><div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span>{article.authorName}</span><span>·</span><span>{article.wordCount.toLocaleString("fr-FR")} mots</span><span>·</span><span>{article.readingTimeMinutes} min de lecture</span>{article.qualityScore !== null && <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 font-bold text-brand"><CheckCircle2 className="size-3.5" aria-hidden />Informations vérifiées</span>}</div>{article.coverCredit ? <p className="text-[11px] text-muted-foreground">Crédit image : {article.coverCredit}</p> : null}<ArticleActions articleId={article.id} title={article.title} /></header><aside className="rounded-2xl border border-brand/30 bg-brand/5 p-5" data-answer><p className="text-[10px] font-black uppercase tracking-widest text-brand">Réponse directe</p><p className="mt-2 text-sm font-semibold leading-relaxed">{article.directAnswer}</p></aside><nav aria-label="Dans cet article" className="rounded-2xl border border-border/70 bg-surface p-5 lg:hidden"><p className="text-xs font-black uppercase tracking-widest">Dans cet article</p><ol className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">{article.content.sections.map((section, index) => <li key={section.heading}><a href={`#section-${index + 1}`} className="hover:text-brand">{index + 1}. {section.heading}</a></li>)}</ol></nav><p className="text-base leading-8">{article.content.summary}</p>{article.content.sections.map((section, index) => <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-24 space-y-4"><h2 className="text-2xl font-black tracking-tight">{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="text-base leading-8 text-foreground/90">{paragraph}</p>)}{section.bullets?.length ? <ul className="space-y-2 rounded-xl bg-surface p-4 text-sm leading-relaxed">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden /><span>{bullet}</span></li>)}</ul> : null}</section>)}{article.internalLinks.length > 0 && <aside className="rounded-2xl border border-brand/30 bg-brand/5 p-5"><p className="text-xs font-black uppercase tracking-widest text-brand">À découvrir sur LiveFoot</p><div className="mt-3 flex flex-wrap gap-2">{article.internalLinks.map((link) => <a key={`${link.path}-${link.label}`} href={link.path} className="rounded-xl bg-brand px-3 py-2 text-xs font-black text-brand-foreground">{link.label}</a>)}</div></aside>}{article.content.faq.length > 0 && <section className="space-y-3"><h2 className="text-2xl font-black tracking-tight">Questions fréquentes</h2>{article.content.faq.map((item) => <details key={item.question} className="rounded-xl border border-border/70 bg-card p-4"><summary className="cursor-pointer text-sm font-black">{item.question}</summary><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p></details>)}</section>}{related.length ? <section aria-labelledby="related-articles" className="space-y-4 border-t border-border/70 pt-8"><div><p className="text-[10px] font-black uppercase tracking-widest text-brand">Pour continuer</p><h2 id="related-articles" className="mt-1 text-2xl font-black tracking-tight">À lire aussi</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Des contenus liés à votre lecture, sélectionnés par catégorie et utilité.</p></div><div className="grid gap-4 md:grid-cols-3">{related.map((item) => <BlogCard key={item.id} article={item} />)}</div></section> : null}<TelegramCtaCard location="blog_article" compact /><section className="space-y-3 rounded-2xl border border-border/70 bg-surface p-5"><h2 className="text-lg font-black">Sources et transparence</h2><p className="text-sm leading-relaxed text-muted-foreground">Cet article s’appuie sur les sources listées ci-dessous. Les informations peuvent évoluer : vérifiez toujours les communications officielles.</p><ul className="space-y-2">{article.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">{source.publisher} — {source.title}<ExternalLink className="size-3.5" aria-hidden /></a></li>)}</ul>{article.disclosure && <p className="text-xs text-muted-foreground">{article.disclosure}</p>}</section><EditorialComments articleId={article.id} /></div><aside className="hidden lg:block"><nav aria-label="Dans cet article" className="sticky top-24 rounded-2xl border border-border/70 bg-surface p-5"><p className="text-xs font-black uppercase tracking-widest">Dans cet article</p><ol className="mt-3 space-y-2 text-sm text-muted-foreground">{article.content.sections.map((section, index) => <li key={section.heading}><a href={`#section-${index + 1}`} className="hover:text-brand">{index + 1}. {section.heading}</a></li>)}</ol></nav></aside></div></article></AppShell>;
}
