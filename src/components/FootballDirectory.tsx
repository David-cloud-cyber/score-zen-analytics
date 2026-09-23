import { ArrowRight, Search, Shield, Trophy, UserRound, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { CoachRow, PlayerRow, TeamRow } from "@/lib/football.functions";

export function FootballDirectoryHeader({
  eyebrow,
  title,
  description,
  search,
  onSearchChange,
  placeholder,
}: {
  eyebrow: string;
  title: string;
  description: string;
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <header className="rounded-2xl border border-border/70 bg-card p-5 sm:rounded-3xl sm:p-7">
      <div className="max-w-2xl">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      </div>
      <label className="relative mt-6 block max-w-2xl">
        <span className="sr-only">{placeholder}</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand"
        />
      </label>
    </header>
  );
}

export function FootballSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        {typeof count === "number" && (
          <span className="text-xs font-bold text-muted-foreground">
            {count} résultat{count > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function FootballEmpty({
  icon = <Shield className="size-5" />,
  title,
  text,
}: {
  icon?: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
        {icon}
      </span>
      <h3 className="mt-3 text-sm font-black">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground text-pretty">
        {text}
      </p>
    </div>
  );
}

export function TeamCard({ team, onSelect }: { team: TeamRow; onSelect?: () => void }) {
  const content = (
    <>
      {team.logo ? (
        <img
          src={team.logo}
          alt={`Logo ${team.name}`}
          className="size-12 shrink-0 object-contain"
          loading="lazy"
        />
      ) : (
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <UsersRound className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">{team.name}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {[team.country, team.code].filter(Boolean).join(" · ") || "Données de l’équipe"}
        </span>
        {team.venue?.name && (
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">
            {team.venue.name}
          </span>
        )}
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
        aria-hidden
      />
    </>
  );
  const className =
    "group flex min-h-24 w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-brand/40 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
  return onSelect ? (
    <button type="button" onClick={onSelect} className={className}>
      {content}
    </button>
  ) : (
    <Link to="/equipes/$id" params={{ id: String(team.id) }} className={className}>
      {content}
    </Link>
  );
}

export function PlayerCard({ player }: { player: PlayerRow }) {
  return (
    <Link
      to="/joueurs/$id"
      params={{ id: String(player.id) }}
      className="group flex min-h-20 items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5 transition-colors hover:border-brand/40 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {player.photo ? (
        <img
          src={player.photo}
          alt=""
          className="size-11 shrink-0 rounded-full bg-surface object-cover"
          loading="lazy"
        />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <UserRound className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">{player.name}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {[player.position, player.nationality, player.team?.name].filter(Boolean).join(" · ") ||
            "Profil joueur"}
        </span>
      </span>
      <span className="text-right text-[11px] font-bold text-muted-foreground">
        <span className="block text-sm font-black text-brand">{player.goals ?? "—"}</span>
        <span>buts</span>
      </span>
    </Link>
  );
}

export function CoachCard({ coach }: { coach: CoachRow }) {
  return (
    <Link
      to="/entraineurs/$id"
      params={{ id: String(coach.id) }}
      className="group flex min-h-20 items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5 transition-colors hover:border-brand/40 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {coach.photo ? (
        <img
          src={coach.photo}
          alt=""
          className="size-11 shrink-0 rounded-full bg-surface object-cover"
          loading="lazy"
        />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <UserRound className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">{coach.name}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {[coach.nationality, coach.team?.name].filter(Boolean).join(" · ") || "Profil entraîneur"}
        </span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
        aria-hidden
      />
    </Link>
  );
}

export function TrophyList({
  trophies,
}: {
  trophies: Array<{
    league: string;
    country: string;
    season: string;
    place: string;
    wins: number | null;
  }>;
}) {
  if (!trophies.length)
    return (
      <FootballEmpty
        icon={<Trophy className="size-5" />}
        title="Palmarès non disponible"
        text="Le fournisseur n’a pas publié de palmarès pour ce profil."
      />
    );
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <ul className="divide-y divide-border/60">
        {trophies.map((trophy, index) => (
          <li
            key={`${trophy.league}-${trophy.season}-${index}`}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Trophy className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{trophy.league}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {[trophy.country, trophy.season].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="text-right text-xs font-bold text-brand">
              {trophy.place || "—"}
              {trophy.wins ? ` · ${trophy.wins}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
