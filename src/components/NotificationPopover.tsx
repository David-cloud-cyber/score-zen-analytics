import { Component, useState, useRef, useEffect, type ErrorInfo, type ReactNode } from "react";
import { Bell, Check, Crown, ExternalLink, LifeBuoy, MessageCircle, Radio, Sparkles, Coins } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { getUserNotifications, markNotificationRead } from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { WebPushControl } from "@/components/WebPushControl";

export type NotificationItem = {
  id: string;
  type: "match" | "ai" | "credit" | "community_reply" | "support_reply" | "vip_status" | "system";
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
};

class NotificationFailureBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // A notification failure is isolated here so navigation and match data stay usable.
  }

  render() {
    if (this.state.failed) {
      return (
        <button
          type="button"
          disabled
          className="grid size-9 place-items-center rounded-full bg-surface text-muted-foreground ring-1 ring-black/5 dark:ring-white/10"
          aria-label="Notifications momentanément indisponibles"
          title="Notifications momentanément indisponibles"
        >
          <Bell className="size-4" aria-hidden />
        </button>
      );
    }
    return this.props.children;
  }
}

export function NotificationPopover() {
  return (
    <NotificationFailureBoundary>
      <NotificationPopoverContent />
    </NotificationFailureBoundary>
  );
}

function NotificationPopoverContent() {
  const { session } = useSession();
  const userId = session?.user.id;
  const getNotifications = useServerFn(getUserNotifications);
  const markRead = useServerFn(markNotificationRead);
  const notificationsQuery = useQuery({ queryKey: ["notifications", userId], queryFn: () => getNotifications(), enabled: Boolean(userId), refetchInterval: 30_000, staleTime: 10_000 });
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "community_reply" | "support_reply" | "vip_status">("all");
  const popoverRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setNotifications((notificationsQuery.data ?? []).map((item) => ({ id: item.id, type: item.type, title: item.title, message: item.message, time: new Date(item.created_at).toLocaleDateString("fr-FR"), read: Boolean(item.read_at), link: item.link ?? undefined })));
  }, [notificationsQuery.data]);
  useEffect(() => {
    if (!userId) return;

    // A channel cannot receive new callbacks after subscribe(). React StrictMode
    // mounts effects twice in development and an asynchronous removeChannel()
    // could therefore return the previous subscribed channel. A unique topic per
    // effect lifecycle makes remounts and rapid session refreshes safe.
    const instanceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(`user_notifications_${userId}_${instanceId}`);
    let active = true;

    try {
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (!active) return;
            const item = payload.new as {
              id: string;
              type: NotificationItem["type"];
              title: string;
              message: string;
              link?: string | null;
              created_at: string;
              read_at?: string | null;
            };
            if (!item?.id) return;
            setNotifications((current) =>
              current.some((notification) => notification.id === item.id)
                ? current
                : [
                    {
                      id: item.id,
                      type: item.type,
                      title: item.title,
                      message: item.message,
                      time: new Date(item.created_at).toLocaleDateString("fr-FR"),
                      read: false,
                      link: item.link ?? undefined,
                    },
                    ...current,
                  ],
            );
          },
        )
        .subscribe();
    } catch {
      // Notifications are best effort and must never make the whole SaaS fail.
      void supabase.removeChannel(channel);
      return;
    }

    return () => {
      active = false;
      void channel.unsubscribe().finally(() => supabase.removeChannel(channel));
    };
  }, [userId]);
  useEffect(() => { function handleClickOutside(event: MouseEvent) { if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setOpen(false); } document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
  const markAllAsRead = () => { setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); if (session) void markRead({ data: { all: true } }); };
  const filtered = filter === "all" ? notifications : notifications.filter((n) => n.type === filter);
  return <div ref={popoverRef} className="relative"><button type="button" onClick={() => setOpen(!open)} className="relative grid size-9 place-items-center rounded-full bg-surface ring-1 ring-black/5 transition-transform hover:scale-105 active:scale-95 dark:ring-white/10" aria-label={`Notifications (${unreadCount} non lues)`}><Bell className="size-4 text-foreground" aria-hidden />{unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-alert text-[9px] font-black text-white shadow-sm">{unreadCount}</span>}</button>{open && <div className="score-popover absolute right-0 top-full z-50 mt-2 w-80 bg-card p-4 animate-in fade-in zoom-in-95 sm:w-96"><div className="mb-3 flex items-center justify-between border-b border-border/60 pb-3"><div className="flex items-center gap-2"><Bell className="size-4 text-brand" /><h3 className="text-sm font-black">Notifications</h3>{unreadCount > 0 && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">{unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}</span>}</div>{unreadCount > 0 && <button type="button" onClick={markAllAsRead} className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"><Check className="size-3" /> Tout lire</button>}</div><div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]"><FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Toutes" /><FilterChip active={filter === "community_reply"} onClick={() => setFilter("community_reply")} label="Communauté" /><FilterChip active={filter === "support_reply"} onClick={() => setFilter("support_reply")} label="Support" /><FilterChip active={filter === "vip_status"} onClick={() => setFilter("vip_status")} label="VIP" /></div><div className="max-h-72 space-y-2 overflow-y-auto pr-1">{filtered.length === 0 ? <div className="py-8 text-center text-xs text-muted-foreground">Aucune notification dans cette catégorie.</div> : filtered.map((item) => <div key={item.id} onClick={() => { setNotifications((prev) => prev.map((n) => n.id === item.id ? { ...n, read: true } : n)); if (session) void markRead({ data: { notificationId: item.id } }); }} className={cn("group relative flex items-start gap-3 rounded-xl p-2.5 transition-colors", item.read ? "bg-transparent hover:bg-surface" : "bg-brand/5 ring-1 ring-brand/10 hover:bg-brand/10")}><div className={cn("grid size-8 shrink-0 place-items-center rounded-full text-xs font-black", item.type === "match" && "bg-alert/10 text-alert", item.type === "ai" && "bg-brand/10 text-brand", item.type === "credit" && "bg-warn/10 text-warn", item.type === "community_reply" && "bg-sky-500/10 text-sky-500", item.type === "support_reply" && "bg-violet-500/10 text-violet-500", item.type === "vip_status" && "bg-brand/10 text-brand")}>{item.type === "match" && <Radio className="size-4" />}{item.type === "ai" && <Sparkles className="size-4" />}{item.type === "credit" && <Coins className="size-4" />}{item.type === "community_reply" && <MessageCircle className="size-4" />}{item.type === "support_reply" && <LifeBuoy className="size-4" />}{item.type === "vip_status" && <Crown className="size-4" />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between"><span className="truncate text-xs font-bold text-foreground">{item.title}</span><span className="text-[10px] text-muted-foreground">{item.time}</span></div><p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{item.message}</p>{item.link && <Link to={item.link} onClick={() => setOpen(false)} className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:underline">Voir <ExternalLink className="size-2.5" /></Link>}</div></div>)}</div><div className="mt-3 border-t border-border/60 pt-3"><WebPushControl /></div></div>}</div>;
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={cn("rounded-full px-2.5 py-1 font-bold transition-all", active ? "bg-foreground text-background shadow-xs" : "bg-surface text-muted-foreground hover:bg-card hover:text-foreground")}>{label}</button>; }
