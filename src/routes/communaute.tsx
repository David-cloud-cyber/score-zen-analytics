import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Flame,
  MessageCircle,
  Radio,
  Reply,
  Send,
  Trophy,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { PremiumCta } from "@/components/PremiumCta";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import {
  castCommunityVote,
  getCommunityOverview,
  getMyCommunityVotes,
  postCommunityMessage,
  replyCommunityMessage,
  toggleCommunityReaction,
  type CommunityMessage,
  type CommunityOverview,
  type CommunityPoll,
  type CommunityVoteOption,
} from "@/lib/community.functions";
import { breadcrumbSchema, buildRouteMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { DEMO_COMMUNITY_POLLS, DEMO_LEADERBOARD, isLocalDemo } from "@/lib/local-demo";
import { TelegramCtaCard } from "@/components/TelegramCtaCard";

export const Route = createFileRoute("/communaute")({
  head: () => ({
    ...buildRouteMeta({
      path: "/communaute",
      title: "Communauté & échanges Live",
      description:
        "Rejoignez la communauté LiveFoot IA : votes sur les matchs réels, discussions et analyses partagées.",
      alternates: [
        { language: "fr", path: "/communaute" },
        { language: "en", path: "/en/community" },
        { language: "x-default", path: "/communaute" },
      ],
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "Accueil", path: "/" },
            { name: "Communauté", path: "/communaute" },
          ]),
        ),
      },
    ],
  }),
  component: CommunautePage,
});

type MatchPoll = CommunityPoll;

const FEATURED_POLLS: MatchPoll[] = DEMO_COMMUNITY_POLLS.map((poll) => ({
  ...poll,
  status: "live",
  kickoff: new Date().toISOString(),
  timeLabel: "En direct",
  minute: null,
}));

const DEMO_MESSAGES: CommunityMessage[] = [
  {
    id: "demo-msg-1",
    user_name: "Momo Foot",
    user_avatar: null,
    message: "Arsenal semble mieux armé dans les transitions ce soir.",
    created_at: new Date().toISOString(),
    match_id: null,
    parent_id: null,
    reactions: {},
  },
  {
    id: "demo-msg-2",
    user_name: "Lina Stats",
    user_avatar: null,
    message: "Le scénario 1X reste le plus cohérent avec les données du jour.",
    created_at: new Date().toISOString(),
    match_id: null,
    parent_id: null,
    reactions: {},
  },
];

function mergeMessages(current: CommunityMessage[], incoming: CommunityMessage): CommunityMessage[] {
  if (current.some((message) => message.id === incoming.id)) return current;
  return [...current, incoming].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}
function friendlyFreshness(overview: CommunityOverview | undefined, loading: boolean): string {
  if (loading) return "Actualisation en cours.";
  if (!overview?.updatedAt) return "Les matchs réels seront affichés dès qu'ils seront disponibles.";
  const updatedAt = new Date(overview.updatedAt).getTime();
  if (!Number.isFinite(updatedAt)) return "Les matchs réels seront affichés dès qu'ils seront disponibles.";
  const elapsed = Math.max(0, Math.round((Date.now() - updatedAt) / 60000));
  if (overview.state === "stale") return `Dernières informations disponibles il y a ${elapsed} min.`;
  return elapsed <= 0 ? "Les données des matchs sont à jour." : `Dernière mise à jour il y a ${elapsed} min.`;
}

function CommunautePage() {
  const demoMode = isLocalDemo();
  const { session } = useSession();
  const navigate = useNavigate();
  const overviewFn = useServerFn(getCommunityOverview);
  const myVotesFn = useServerFn(getMyCommunityVotes);
  const voteFn = useServerFn(castCommunityVote);
  const messageFn = useServerFn(postCommunityMessage);
  const replyFn = useServerFn(replyCommunityMessage);
  const reactionFn = useServerFn(toggleCommunityReaction);
  const overviewQuery = useQuery({
    queryKey: ["community", "overview"],
    queryFn: () => overviewFn(),
    enabled: !demoMode,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
  const [messages, setMessages] = useState<CommunityMessage[]>(demoMode ? DEMO_MESSAGES : []);
  const [newMessage, setNewMessage] = useState("");
  const [polls, setPolls] = useState<MatchPoll[]>(demoMode ? FEATURED_POLLS : []);
  const [leaderboard, setLeaderboard] = useState<CommunityOverview["leaderboard"]>(
    demoMode
      ? DEMO_LEADERBOARD.map((item) => ({
          rank: item.rank,
          name: item.name,
          wins: Number.parseInt(item.winRate, 10),
          settled: item.points,
        }))
      : [],
  );
  const [userVotes, setUserVotes] = useState<Record<number, CommunityVoteOption>>({});
  const [pendingVote, setPendingVote] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (demoMode || !overviewQuery.data) return;
    setPolls(overviewQuery.data.polls);
    setMessages(overviewQuery.data.messages);
    setLeaderboard(overviewQuery.data.leaderboard);
  }, [demoMode, overviewQuery.data]);

  const pollIds = polls.map((poll) => poll.id);
  const myVotesQuery = useQuery({
    queryKey: ["community", "my-votes", pollIds.join(",")],
    queryFn: () => myVotesFn({ data: { fixtureIds: pollIds } }),
    enabled: !demoMode && Boolean(session) && pollIds.length > 0,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (myVotesQuery.data) setUserVotes(myVotesQuery.data);
  }, [myVotesQuery.data]);

  useEffect(() => {
    if (demoMode) return;
    const channel = supabase
      .channel("community_messages_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        (payload) => {
          const row = payload.new as CommunityMessage;
          if (!row?.id || !row.message) return;
          setMessages((current) => mergeMessages(current, row));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demoMode]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 96;
    if (nearBottom) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleVote = async (poll: MatchPoll, option: CommunityVoteOption) => {
    if (!session && !demoMode) {
      navigate({ to: "/auth", search: { redirect: "/communaute" } });
      return;
    }
    if (demoMode) {
      if (userVotes[poll.id]) return toast.info("Vous avez déjà voté pour ce match !");
      setUserVotes((current) => ({ ...current, [poll.id]: option }));
      setPolls((current) => current.map((item) => item.id === poll.id ? { ...item, votes: { ...item.votes, [option]: item.votes[option] + 1 } } : item));
      toast.success("Vote enregistré avec succès !");
      return;
    }
    if (userVotes[poll.id] || pendingVote === poll.id) {
      toast.info("Vous avez déjà voté pour ce match !");
      return;
    }
    setPendingVote(poll.id);
    try {
      const result = await voteFn({
        data: {
          fixtureId: poll.id,
          homeTeam: poll.homeTeam,
          awayTeam: poll.awayTeam,
          prediction: option,
        },
      });
      setUserVotes((current) => ({ ...current, [poll.id]: option }));
      setPolls((current) => current.map((item) => item.id === poll.id ? { ...item, votes: result.counts } : item));
      toast.success("Vote enregistré avec succès !");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Votre vote n'a pas pu être enregistré.");
    } finally {
      setPendingVote(null);
    }
  };

  const handleSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const value = newMessage.trim().slice(0, 500);
    if (!value) return;
    if (!session && !demoMode) {
      navigate({ to: "/auth", search: { redirect: "/communaute" } });
      return;
    }
    if (demoMode) {
      setMessages((current) => mergeMessages(current, {
        id: `demo-${Date.now()}`,
        user_name: "Dodo Bien",
        user_avatar: null,
        message: value,
        created_at: new Date().toISOString(),
        match_id: null,
        parent_id: null,
        reactions: {},
      }));
      setNewMessage("");
      return;
    }
    setSending(true);
    try {
      const created = await messageFn({ data: { message: value, matchId: null } });
      setMessages((current) => mergeMessages(current, created));
      setNewMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Votre message n'a pas pu être publié.");
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (event: FormEvent, parentId: string) => {
    event.preventDefault();
    const value = replyText.trim().slice(0, 500);
    if (!value) return;
    if (!session && !demoMode) {
      navigate({ to: "/auth", search: { redirect: "/communaute" } });
      return;
    }
    if (demoMode) {
      setMessages((current) => mergeMessages(current, { id: `demo-reply-${Date.now()}`, user_name: "Dodo Bien", user_avatar: null, message: value, created_at: new Date().toISOString(), match_id: null, parent_id: parentId, reactions: {} }));
      setReplyText("");
      setReplyingTo(null);
      return;
    }
    try {
      const created = await replyFn({ data: { parentId, message: value } });
      setMessages((current) => mergeMessages(current, created));
      setReplyText("");
      setReplyingTo(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Votre réponse n'a pas pu être publiée.");
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!session && !demoMode) {
      navigate({ to: "/auth", search: { redirect: "/communaute" } });
      return;
    }
    if (demoMode) return;
    try {
      const reactions = await reactionFn({ data: { messageId, emoji: emoji as "👍" | "❤️" | "🔥" | "😂" | "⚽" | "👀" } });
      setMessages((current) => current.map((item) => item.id === messageId ? { ...item, reactions } : item));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "La réaction n'a pas pu être enregistrée.");
    }
  };

  return (
    <AppShell>
      <div className="hidden md:block">
      <PageTitle eyebrow="Espace public" title="Communauté Livefoot IA" />

        <div className="score-dark-surface relative animate-rise overflow-hidden rounded-xl bg-[#181818] p-6 text-[#f7f7f7] shadow-none">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand/25 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full bg-data/25 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
              <Radio className="size-3 animate-pulse" /> En direct Live
            </div>
            <h2 className="text-xl font-black leading-tight lg:text-2xl">Pronostiquez & échangez en temps réel</h2>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-[#b7c1cb] lg:text-sm">
              Consultez les matchs réels, partagez votre avis et comparez les tendances de la communauté.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4 pb-28 lg:px-0">

        <TelegramCtaCard location="community_hero" compact />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">Approfondissez les matchs suivis par la communauté avec les analyses Premium.</p>
          <PremiumCta location="community_intro" compact label="Voir Premium" />
        </div>

        <div className="space-y-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-alert" />
              <h3 className="text-sm font-black uppercase tracking-wider">Pronostics de la communauté</h3>
            </div>
            <span className="text-right text-[11px] font-bold text-muted-foreground">{friendlyFreshness(overviewQuery.data, overviewQuery.isFetching)}</span>
          </div>

          {polls.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {polls.map((poll) => {
                const totalVotes = poll.votes.home + poll.votes.draw + poll.votes.away;
                const homePct = totalVotes ? Math.round((poll.votes.home / totalVotes) * 100) : 0;
                const drawPct = totalVotes ? Math.round((poll.votes.draw / totalVotes) * 100) : 0;
                const awayPct = totalVotes ? Math.max(0, 100 - homePct - drawPct) : 0;
                const selected = userVotes[poll.id];
                return (
                  <div key={poll.id} className="animate-rise space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-none">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2 text-[10px] font-bold text-muted-foreground">
                      <span>{poll.league}</span>
                      <span className="rounded-full bg-surface px-2 py-0.5">{totalVotes} vote{totalVotes > 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-2">
                      <div className="flex min-w-0 items-center gap-2"><img src={poll.homeLogo} alt="" className="size-8 object-contain" /><span className="truncate text-xs font-bold">{poll.homeTeam}</span></div>
                      <span className="shrink-0 text-xs font-black text-muted-foreground">VS</span>
                      <div className="flex min-w-0 items-center gap-2"><span className="truncate text-xs font-bold">{poll.awayTeam}</span><img src={poll.awayLogo} alt="" className="size-8 object-contain" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <VoteButton label={`1 (${homePct}%)`} selected={selected === "home"} disabled={Boolean(pendingVote)} onClick={() => void handleVote(poll, "home")} />
                      <VoteButton label={`N (${drawPct}%)`} selected={selected === "draw"} disabled={Boolean(pendingVote)} onClick={() => void handleVote(poll, "draw")} />
                      <VoteButton label={`2 (${awayPct}%)`} selected={selected === "away"} disabled={Boolean(pendingVote)} onClick={() => void handleVote(poll, "away")} />
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface" aria-label="Répartition des votes">
                      <div style={{ width: `${homePct}%` }} className="bg-brand transition-all" />
                      <div style={{ width: `${drawPct}%` }} className="bg-warn transition-all" />
                      <div style={{ width: `${awayPct}%` }} className="bg-data transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">Aucun match réel à voter pour le moment.</div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex h-[460px] flex-col rounded-xl border border-border/70 bg-card shadow-none lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
              <div className="flex items-center gap-2"><MessageCircle className="size-4 text-brand" /><h3 className="text-xs font-black uppercase tracking-wider">Chat live général</h3></div>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500"><span className="size-2 rounded-full bg-emerald-500" /> En ligne</span>
            </div>
            <div ref={chatScrollRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {messages.length ? messages.filter((message) => !message.parent_id).map((message) => {
                const replies = messages.filter((child) => child.parent_id === message.id);
                return <div key={message.id} className="space-y-2">
                  <MessageBubble message={message} onReply={() => { setReplyingTo(message.id); setReplyText(""); }} onReaction={(emoji) => void handleReaction(message.id, emoji)} />
                  {replies.map((reply) => <div key={reply.id} className="ml-8"><MessageBubble message={reply} onReply={() => { setReplyingTo(message.id); setReplyText(""); }} onReaction={(emoji) => void handleReaction(reply.id, emoji)} compact /></div>)}
                  {replyingTo === message.id && <form onSubmit={(event) => void handleReply(event, message.id)} className="ml-8 flex gap-2 rounded-xl bg-surface p-2"><input autoFocus value={replyText} maxLength={500} onChange={(event) => setReplyText(event.target.value)} placeholder="Répondre..." className="min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground" /><button type="submit" disabled={!replyText.trim()} className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground text-background disabled:opacity-40" aria-label="Publier la réponse"><Send className="size-3.5" /></button></form>}
                </div>;
              }) : <p className="py-12 text-center text-xs text-muted-foreground">Aucun message pour le moment.</p>}
            </div>
            <form onSubmit={(event) => void handleSendMessage(event)} className="border-t border-border/60 p-3">
              <div className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand dark:ring-white/10">
                <input type="text" value={newMessage} maxLength={500} onChange={(event) => setNewMessage(event.target.value)} placeholder={session ? "Écrivez un message..." : "Connectez-vous pour discuter..."} className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" aria-label="Message" />
                <button type="submit" disabled={!newMessage.trim() || sending} aria-label="Envoyer le message" className="grid size-8 shrink-0 place-items-center rounded-xl bg-foreground text-background transition-transform hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40"><Send className="size-3.5" /></button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">{session ? "Votre message sera visible par la communauté." : "La lecture est publique. Connectez-vous pour participer."}</p>
            </form>
          </div>

          <div className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-none">
            <div className="flex items-center justify-between border-b border-border/60 pb-3"><div className="flex items-center gap-2"><Trophy className="size-4 text-warn" /><h3 className="text-xs font-black uppercase tracking-wider">Top pronostiqueurs</h3></div><span className="text-[10px] font-bold text-muted-foreground">Résultats réels</span></div>
            {leaderboard.length ? <ul className="space-y-2.5">{leaderboard.map((user) => <li key={`${user.rank}-${user.name}`} className="flex items-center justify-between rounded-2xl bg-surface p-2.5 text-xs ring-1 ring-black/5 dark:ring-white/5"><div className="flex min-w-0 items-center gap-2.5"><span className="grid size-6 place-items-center rounded-full bg-foreground text-[10px] font-black text-background">{user.rank}</span><div className="min-w-0 truncate"><div className="truncate font-bold">{user.name}</div><div className="text-[9px] text-muted-foreground">{user.settled} analyse{user.settled > 1 ? "s" : ""} réglée{user.settled > 1 ? "s" : ""}</div></div></div><div className="shrink-0 text-right"><div className="font-black text-brand">{user.wins} réussite{user.wins > 1 ? "s" : ""}</div></div></li>)}</ul> : <div className="rounded-2xl bg-surface p-4 text-center text-xs text-muted-foreground">Le classement sera disponible après les premières analyses réglées.</div>}
            <div className="rounded-2xl bg-brand/10 p-3 text-center text-[11px] font-bold text-brand">Partagez des avis utiles et respectueux avec les autres passionnés.</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function VoteButton({ label, selected, disabled, onClick }: { label: string; selected?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={cn("rounded-2xl bg-surface px-1 py-2 text-center text-xs font-black text-foreground transition-all ring-1 ring-black/5 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50", selected && "bg-foreground text-background ring-foreground shadow-md")}>{label}</button>;
}

function MessageBubble({ message, onReply, onReaction, compact = false }: { message: CommunityMessage; onReply: () => void; onReaction: (emoji: string) => void; compact?: boolean }) {
  const emojis = ["👍", "❤️", "🔥", "😂", "⚽", "👀"];
  return <div className={cn("flex items-start gap-3 text-xs", compact && "text-[11px]")}>
    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-surface font-black text-brand ring-1 ring-black/5 dark:ring-white/10"><User className="size-4" /></div>
    <div className="min-w-0 flex-1 rounded-2xl bg-surface p-3 ring-1 ring-black/5 dark:ring-white/5">
      <div className="mb-1 flex items-center justify-between gap-2"><span className="truncate font-bold text-foreground">{message.user_name}</span><span className="shrink-0 text-[9px] text-muted-foreground">{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
      <p className="break-words leading-relaxed text-muted-foreground">{message.message}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {emojis.map((emoji) => <button key={emoji} type="button" onClick={() => onReaction(emoji)} className="rounded-full bg-card px-1.5 py-0.5 text-[11px] ring-1 ring-border/60 hover:ring-brand" aria-label={`Réagir ${emoji}`}><span>{emoji}</span>{message.reactions?.[emoji] ? <span className="ml-1 text-[10px] font-bold text-muted-foreground">{message.reactions[emoji]}</span> : null}</button>)}
        <button type="button" onClick={onReply} className="ml-auto inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-[10px] font-bold text-muted-foreground ring-1 ring-border/60 hover:text-foreground"><Reply className="size-3" /> Répondre</button>
      </div>
    </div>
  </div>;
}
