import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  MessageCircle,
  Send,
  Users,
  Sparkles,
  Trophy,
  Flame,
  CheckCircle2,
  User,
  Radio,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { buildRouteMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { DEMO_COMMUNITY_POLLS, DEMO_LEADERBOARD, isLocalDemo } from "@/lib/local-demo";

export const Route = createFileRoute("/communaute")({
  head: () =>
    buildRouteMeta({
      path: "/communaute",
      title: "Communauté & Échanges Live",
      description:
        "Rejoignez la communauté Livefoot IA : pronostics en direct, chat live par match, sondages de foule et classement des experts.",
    }),
  component: CommunautePage,
});

interface ChatMessage {
  id: string;
  user_name: string;
  user_avatar?: string;
  message: string;
  created_at: string;
}

interface MatchPoll {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  votes: { home: number; draw: number; away: number };
}

const FEATURED_POLLS: MatchPoll[] = DEMO_COMMUNITY_POLLS;

const LEADERBOARD = DEMO_LEADERBOARD;

const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: "demo-msg-1",
    user_name: "Momo Foot",
    message: "Arsenal semble mieux armé dans les transitions ce soir.",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-msg-2",
    user_name: "Lina Stats",
    message: "Le scénario 1X reste le plus cohérent avec les données du jour.",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-msg-3",
    user_name: "Dodo Bien",
    message: "Je surveille surtout le marché des buts en seconde période.",
    created_at: new Date().toISOString(),
  },
];

function CommunautePage() {
  const demoMode = isLocalDemo();
  const { session, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>(demoMode ? DEMO_MESSAGES : []);
  const [newMessage, setNewMessage] = useState("");
  const [userVotes, setUserVotes] = useState<Record<number, "home" | "draw" | "away">>({});
  const [polls, setPolls] = useState<MatchPoll[]>(FEATURED_POLLS);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Rediriger vers /auth si non connecté (après chargement)
  useEffect(() => {
    if (!demoMode && !sessionLoading && !session) {
      navigate({ to: "/auth", search: { redirect: "/communaute" } });
    }
  }, [demoMode, sessionLoading, session, navigate]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription setup fallback
  useEffect(() => {
    if (demoMode) return;
    const channel = supabase
      .channel("community_messages_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMsg]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [demoMode]);

  const handleVote = (pollId: number, option: "home" | "draw" | "away") => {
    if (userVotes[pollId]) {
      toast.info("Vous avez déjà voté pour ce match !");
      return;
    }

    setUserVotes((prev) => ({ ...prev, [pollId]: option }));
    setPolls((prev) =>
      prev.map((poll) => {
        if (poll.id === pollId) {
          return {
            ...poll,
            votes: {
              ...poll.votes,
              [option]: poll.votes[option] + 1,
            },
          };
        }
        return poll;
      }),
    );
    toast.success("Vote enregistré avec succès !");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const userName =
      session?.user?.email?.split("@")[0] || "Fan_" + Math.floor(Math.random() * 1000);
    const msgObj: ChatMessage = {
      id: Date.now().toString(),
      user_name: userName,
      message: newMessage.trim(),
      created_at: new Date().toISOString(),
    };

    // Optimistic insert
    setMessages((prev) => [...prev, msgObj]);
    setNewMessage("");
  };

  return (
    <AppShell>
      <PageTitle eyebrow="Espace Membres" title="Communauté Livefoot IA" />

      <div className="space-y-6 px-4 pb-20 lg:px-0">
        {/* Banner Hero */}
        <div className="relative animate-rise overflow-hidden rounded-xl bg-[#181818] p-6 text-[#f7f7f7] shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand/25 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full bg-data/25 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
              <Radio className="size-3 animate-pulse" /> En Direct Live
            </div>
            <h2 className="text-xl font-black leading-tight lg:text-2xl">
              Pronostiquez & Échangez en temps réel
            </h2>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-background/70 lg:text-sm">
              Partagez vos analyses, comparez les votes de la communauté avec l'IA et grimpez dans
              le classement mensuel des meilleurs experts.
            </p>
          </div>
        </div>

        {/* Section 1: Crowd Wisdom / Sondages en direct */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-alert" />
              <h3 className="text-sm font-black uppercase tracking-wider">
                Pronostics de la Communauté
              </h3>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">Matchs Vedettes</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {polls.map((poll) => {
              const totalVotes = poll.votes.home + poll.votes.draw + poll.votes.away;
              const homePct = Math.round((poll.votes.home / totalVotes) * 100);
              const drawPct = Math.round((poll.votes.draw / totalVotes) * 100);
              const awayPct = Math.round((poll.votes.away / totalVotes) * 100);
              const userVoted = userVotes[poll.id];

              return (
                <div
                  key={poll.id}
                  className="animate-rise rounded-xl border border-border/70 bg-card p-4 shadow-none space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-border/60 pb-2 text-[10px] font-bold text-muted-foreground">
                    <span>{poll.league}</span>
                    <span className="rounded-full bg-surface px-2 py-0.5">{totalVotes} votes</span>
                  </div>

                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <img src={poll.homeLogo} alt="" className="size-8 object-contain" />
                      <span className="text-xs font-bold">{poll.homeTeam}</span>
                    </div>
                    <span className="text-xs font-black text-muted-foreground">VS</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{poll.awayTeam}</span>
                      <img src={poll.awayLogo} alt="" className="size-8 object-contain" />
                    </div>
                  </div>

                  {/* Vote Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <VoteButton
                      label={`1 (${homePct}%)`}
                      selected={userVoted === "home"}
                      onClick={() => handleVote(poll.id, "home")}
                    />
                    <VoteButton
                      label={`N (${drawPct}%)`}
                      selected={userVoted === "draw"}
                      onClick={() => handleVote(poll.id, "draw")}
                    />
                    <VoteButton
                      label={`2 (${awayPct}%)`}
                      selected={userVoted === "away"}
                      onClick={() => handleVote(poll.id, "away")}
                    />
                  </div>

                  {/* Progress Bar Visualizer */}
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      style={{ width: `${homePct}%` }}
                      className="bg-brand transition-all"
                      title={`1: ${homePct}%`}
                    />
                    <div
                      style={{ width: `${drawPct}%` }}
                      className="bg-warn transition-all"
                      title={`N: ${drawPct}%`}
                    />
                    <div
                      style={{ width: `${awayPct}%` }}
                      className="bg-data transition-all"
                      title={`2: ${awayPct}%`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Live Chat Feed & Leaderboard Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Chat Feed (2 cols) */}
          <div className="lg:col-span-2 flex h-[460px] flex-col rounded-xl border border-border/70 bg-card shadow-none">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-4 text-brand" />
                <h3 className="text-xs font-black uppercase tracking-wider">Chat Live Général</h3>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                En ligne
              </span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className="flex items-start gap-3 text-xs">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-surface font-black text-brand ring-1 ring-black/5 dark:ring-white/10">
                    <User className="size-4" />
                  </div>
                  <div className="flex-1 rounded-2xl bg-surface p-3 ring-1 ring-black/5 dark:ring-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-foreground">{m.user_name}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{m.message}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="border-t border-border/60 p-3">
              <div className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 ring-1 ring-black/5 dark:ring-white/10 focus-within:ring-2 focus-within:ring-brand">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={
                    session ? "Écrivez un message..." : "Connectez-vous pour discuter..."
                  }
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="grid size-8 place-items-center rounded-xl bg-foreground text-background transition-transform active:scale-95 disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                </button>
              </div>
            </form>
          </div>

          {/* Leaderboard (1 col) */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-none space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-warn" />
                <h3 className="text-xs font-black uppercase tracking-wider">Top Pronostiqueurs</h3>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">Ce mois</span>
            </div>

            <ul className="space-y-2.5">
              {LEADERBOARD.map((user) => (
                <li
                  key={user.rank}
                  className="flex items-center justify-between rounded-2xl bg-surface p-2.5 text-xs ring-1 ring-black/5 dark:ring-white/5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-[10px] font-black",
                        user.rank === 1 && "bg-warn text-white",
                        user.rank === 2 && "bg-muted text-foreground",
                        user.rank === 3 && "bg-amber-700 text-white",
                        user.rank > 3 && "bg-surface text-muted-foreground",
                      )}
                    >
                      {user.rank}
                    </span>
                    <div className="truncate">
                      <div className="font-bold truncate">{user.name}</div>
                      <div className="text-[9px] text-muted-foreground">{user.badge}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-brand">{user.points} pts</div>
                    <div className="text-[9px] font-semibold text-emerald-500">
                      {user.winRate} succés
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="rounded-2xl bg-brand/10 p-3 text-center text-[11px] text-brand font-bold">
              ⚡ Pronostiquez sur les matchs pour remonter le classement !
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function VoteButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl py-2 text-center text-xs font-black transition-all ring-1",
        selected
          ? "bg-foreground text-background ring-foreground shadow-md"
          : "bg-surface text-foreground ring-black/5 dark:ring-white/10 hover:bg-card",
      )}
    >
      {label}
    </button>
  );
}
