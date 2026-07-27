import { useState, useRef, useEffect } from "react";
import { Bell, Sparkles, Radio, Coins, Check, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  type: "match" | "ai" | "credit";
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export function NotificationPopover() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<"all" | "match" | "ai" | "credit">("all");
  const popoverRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filtered = filter === "all" ? notifications : notifications.filter((n) => n.type === filter);

  return (
    <div ref={popoverRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative grid size-9 place-items-center rounded-full bg-surface ring-1 ring-black/5 transition-transform hover:scale-105 active:scale-95 dark:ring-white/10"
        aria-label={`Notifications (${unreadCount} non lues)`}
      >
        <Bell className="size-4 text-foreground" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-alert text-[9px] font-black text-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-3xl bg-card p-4 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-brand" />
              <h3 className="text-sm font-black">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
                  {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
              >
                <Check className="size-3" /> Tout lire
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Toutes" />
            <FilterChip active={filter === "match"} onClick={() => setFilter("match")} label="Matchs ⚽" />
            <FilterChip active={filter === "ai"} onClick={() => setFilter("ai")} label="Analyses ✨" />
            <FilterChip active={filter === "credit"} onClick={() => setFilter("credit")} label="Crédits 🪙" />
          </div>

          {/* Notification List */}
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Aucune notification dans cette catégorie.
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
                  }}
                  className={cn(
                    "group relative flex items-start gap-3 rounded-2xl p-2.5 transition-colors",
                    item.read ? "bg-transparent hover:bg-surface" : "bg-brand/5 ring-1 ring-brand/10 hover:bg-brand/10",
                  )}
                >
                  <div
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full text-xs font-black",
                      item.type === "match" && "bg-alert/10 text-alert",
                      item.type === "ai" && "bg-brand/10 text-brand",
                      item.type === "credit" && "bg-warn/10 text-warn",
                    )}
                  >
                    {item.type === "match" && <Radio className="size-4" />}
                    {item.type === "ai" && <Sparkles className="size-4" />}
                    {item.type === "credit" && <Coins className="size-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs font-bold text-foreground">{item.title}</span>
                      <span className="text-[10px] text-muted-foreground">{item.time}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">{item.message}</p>
                    {item.link && (
                      <Link
                        to={item.link}
                        onClick={() => setOpen(false)}
                        className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:underline"
                      >
                        <span>Voir la fiche</span>
                        <ExternalLink className="size-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 font-bold transition-all",
        active
          ? "bg-foreground text-background shadow-xs"
          : "bg-surface text-muted-foreground hover:bg-card hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
