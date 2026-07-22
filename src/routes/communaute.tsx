import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Flame, Hand, Brain, Heart, MessageCircle, Send, Users, Sparkles, Radio, Trophy, Filter } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { THREADS, type Comment, type Reaction, type Thread } from "@/data/community";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/communaute")({
  head: () => ({
    meta: [
      { title: "Communauté — LiveFoot AI" },
      { name: "description", content: "Discutez des matchs, partagez vos pronostics et rejoignez la communauté LiveFoot AI par compétition ou par rencontre." },
      { property: "og:title", content: "Communauté LiveFoot AI" },
      { property: "og:description", content: "Discussions live, pronostics et débats tactiques par compétition et par match." },
      { property: "og:url", content: "https://ball-predict-ace.lovable.app/communaute" },
      { name: "twitter:title", content: "Communauté LiveFoot AI" },
      { name: "twitter:description", content: "Discussions live, pronostics et débats tactiques entre passionnés." },
    ],
    links: [{ rel: "canonical", href: "https://ball-predict-ace.lovable.app/communaute" }],
  }),
  component: CommunautePage,
});

const FILTERS = [
  { id: "all", label: "Tout", icon: Sparkles },
  { id: "match", label: "Matchs", icon: Radio },
  { id: "competition", label: "Compétitions", icon: Trophy },
] as const;

function CommunautePage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [active, setActive] = useState<string>(THREADS[0].id);

  const visibleThreads = useMemo(
    () => THREADS.filter((t) => filter === "all" || t.scope === filter),
    [filter],
  );
  const activeThread = visibleThreads.find((t) => t.id === active) ?? visibleThreads[0];

  return (
    <AppShell>
      <PageTitle
        eyebrow="Communauté"
        title="Discussions live"
        action={
          <div className="hidden items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand ring-1 ring-brand/20 lg:inline-flex">
            <Users className="size-3" /> 4 862 en ligne
          </div>
        }
      />

      {/* Filter pills */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 lg:px-0" role="tablist" aria-label="Filtrer les fils">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const activeFilter = filter === f.id;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={activeFilter}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all",
                activeFilter
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted-foreground ring-1 ring-black/5 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden /> {f.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 px-4 lg:grid-cols-[300px_1fr] lg:gap-6 lg:px-0">
        {/* Threads list */}
        <aside aria-label="Fils de discussion">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Fils actifs
            </h2>
            <button className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-foreground" aria-label="Filtrer">
              <Filter className="size-3" /> Tri
            </button>
          </div>
          <ul className="space-y-2" role="list">
            {visibleThreads.map((t) => (
              <li key={t.id}>
                <ThreadCard
                  thread={t}
                  active={activeThread?.id === t.id}
                  onSelect={() => setActive(t.id)}
                />
              </li>
            ))}
          </ul>
        </aside>

        {/* Active thread */}
        {activeThread && (
          <section aria-label={`Discussion : ${activeThread.title}`} className="min-w-0">
            <ThreadHeader thread={activeThread} />
            <ul className="mt-4 space-y-3" role="list">
              {activeThread.comments.map((c) => (
                <li key={c.id}>
                  <CommentCard comment={c} />
                </li>
              ))}
            </ul>
            <Composer />
          </section>
        )}
      </div>
    </AppShell>
  );
}

function ThreadCard({ thread, active, onSelect }: { thread: Thread; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full rounded-2xl p-3 text-left ring-1 transition-all",
        active
          ? "bg-foreground text-background ring-foreground"
          : "bg-card ring-black/5 hover:ring-black/10",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: thread.color }} aria-hidden />
        <span className={cn("text-[9px] font-black uppercase tracking-widest", active ? "text-white/60" : "text-muted-foreground")}>
          {thread.scope === "match" ? "Match" : "Compétition"}
        </span>
        <span className={cn("ml-auto inline-flex items-center gap-1 text-[10px] font-bold", active ? "text-brand" : "text-alert")}>
          <span className={cn("size-1.5 rounded-full animate-pulse-dot", active ? "bg-brand" : "bg-alert")} aria-hidden />
          {thread.activeUsers.toLocaleString("fr-FR")}
        </span>
      </div>
      <div className="text-sm font-black leading-tight">{thread.title}</div>
      <div className={cn("mt-1 text-[11px]", active ? "text-white/60" : "text-muted-foreground")}>
        {thread.subtitle}
      </div>
    </button>
  );
}

function ThreadHeader({ thread }: { thread: Thread }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-foreground p-5 text-background"
      style={{ borderLeft: `4px solid ${thread.color}` }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full blur-3xl" style={{ background: thread.color, opacity: 0.25 }} aria-hidden />
      <div className="relative">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest">
          {thread.scope === "match" ? <Radio className="size-3" /> : <Trophy className="size-3" />}
          {thread.scope === "match" ? "Match" : "Compétition"}
        </div>
        <h3 className="text-lg font-black leading-tight tracking-tight lg:text-2xl">{thread.title}</h3>
        <p className="mt-1 text-xs text-white/70">{thread.subtitle}</p>
        <div className="mt-4 flex items-center gap-4 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-white/85">
            <span className="size-1.5 rounded-full bg-alert animate-pulse-dot" aria-hidden />
            <span className="font-bold">{thread.activeUsers.toLocaleString("fr-FR")}</span> en ligne
          </span>
          <span className="inline-flex items-center gap-1.5 text-white/85">
            <MessageCircle className="size-3" aria-hidden />
            <span className="font-bold">{thread.comments.length}</span> messages
          </span>
          {thread.scope === "match" && (
            <Link to="/match/$id" params={{ id: thread.scopeId }} className="ml-auto rounded-full bg-brand px-3 py-1 text-[10px] font-black text-brand-foreground">
              Fiche match
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

const REACTION_ICONS: Record<Reaction, { Icon: typeof Flame; color: string; label: string }> = {
  fire: { Icon: Flame, color: "text-alert", label: "En feu" },
  clap: { Icon: Hand, color: "text-warn", label: "Bravo" },
  brain: { Icon: Brain, color: "text-data", label: "Analyse pertinente" },
  heart: { Icon: Heart, color: "text-brand", label: "Coup de cœur" },
};

function CommentCard({ comment }: { comment: Comment }) {
  const [reactions, setReactions] = useState(comment.reactions);
  const [picked, setPicked] = useState<Reaction | null>(null);

  const toggle = (r: Reaction) => {
    setReactions((prev) => {
      const next = { ...prev };
      if (picked === r) {
        next[r] = Math.max(0, next[r] - 1);
        setPicked(null);
      } else {
        if (picked) next[picked] = Math.max(0, next[picked] - 1);
        next[r] = next[r] + 1;
        setPicked(r);
      }
      return next;
    });
  };

  return (
    <article
      className="rounded-2xl bg-card p-4 ring-1 ring-black/5"
      aria-label={`Commentaire de ${comment.author}, ${comment.timeAgo}`}
    >
      <header className="flex items-center gap-3">
        <div
          className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-black text-white"
          style={{ background: comment.avatarColor }}
          aria-hidden
        >
          {comment.author.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-black">{comment.author}</span>
            {comment.badge === "top" && <BadgePill label="Top" tone="brand" />}
            {comment.badge === "expert" && <BadgePill label="Expert" tone="data" />}
            {comment.badge === "premium" && <BadgePill label="Premium" tone="warn" />}
          </div>
          <div className="text-[10px] text-muted-foreground">
            @{comment.handle} · {comment.timeAgo}
          </div>
        </div>
      </header>

      <p className="mt-3 text-[13px] leading-relaxed text-foreground">{comment.text}</p>

      {comment.prediction && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-data/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-data ring-1 ring-data/20">
          <Sparkles className="size-3" aria-hidden /> Pronostic : {comment.prediction}
        </div>
      )}

      <footer className="mt-3 flex items-center gap-1.5" aria-label="Réactions">
        {(Object.keys(REACTION_ICONS) as Reaction[]).map((r) => {
          const { Icon, color, label } = REACTION_ICONS[r];
          const isPicked = picked === r;
          return (
            <button
              key={r}
              onClick={() => toggle(r)}
              aria-pressed={isPicked}
              aria-label={`${label} — ${reactions[r]} réactions`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ring-1 transition-all",
                isPicked
                  ? "bg-foreground text-background ring-foreground"
                  : "bg-surface text-muted-foreground ring-black/5 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-3.5", !isPicked && color)} aria-hidden />
              <span className="tabular-nums">{reactions[r]}</span>
            </button>
          );
        })}
        <button
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
          aria-label={`Voir les ${comment.replies} réponses`}
        >
          <MessageCircle className="size-3.5" aria-hidden /> {comment.replies}
        </button>
      </footer>
    </article>
  );
}

function BadgePill({ label, tone }: { label: string; tone: "brand" | "data" | "warn" }) {
  const tones = {
    brand: "bg-brand/15 text-brand",
    data: "bg-data/15 text-data",
    warn: "bg-warn/15 text-warn",
  };
  return (
    <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest", tones[tone])}>
      {label}
    </span>
  );
}

function Composer() {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setText(""); }}
      className="sticky bottom-24 mt-4 rounded-2xl bg-card p-3 ring-1 ring-black/5 lg:bottom-4"
      aria-label="Publier un message"
    >
      <label htmlFor="composer" className="sr-only">Votre message</label>
      <div className="flex items-start gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-black text-background" aria-hidden>
          AL
        </div>
        <textarea
          id="composer"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="Partagez votre analyse, un pronostic…"
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
        <span className="text-[10px] text-muted-foreground tabular-nums" aria-live="polite">
          {text.length}/280
        </span>
        <button
          type="submit"
          disabled={!text.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-[11px] font-black text-background transition-all disabled:opacity-40"
        >
          <Send className="size-3.5" aria-hidden /> Publier
        </button>
      </div>
    </form>
  );
}
