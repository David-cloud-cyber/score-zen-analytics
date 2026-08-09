import { AppShell } from "@/components/AppShell";

/** Skeleton affiché pendant le chargement des données (useSuspenseQuery). */
export function PageSkeleton() {
  return (
    <AppShell>
      <div className="animate-score-shimmer px-4 pt-6 lg:px-0 lg:pt-8">
        {/* Titre */}
        <div className="mb-6">
          <div className="mb-2 h-3 w-24 rounded-full bg-surface" />
          <div className="h-8 w-48 rounded-lg bg-surface" />
        </div>

        {/* Filtres */}
        <div className="mb-4 flex gap-2">
          {[80, 72, 88].map((w) => (
            <div key={w} className="h-8 rounded-full bg-surface" style={{ width: w }} />
          ))}
        </div>

        {/* Hero card */}
        <div className="mb-6 h-44 rounded-xl bg-surface" />

        {/* Listes de matchs */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="mb-3 h-3 w-32 rounded-full bg-surface" />
              <div className="space-y-3">
                {[1, 2].map((j) => (
                  <div key={j} className="h-16 rounded-xl bg-surface" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

/** Skeleton pour la fiche d'un match. */
export function MatchSkeleton() {
  return (
    <AppShell>
      <div className="animate-score-shimmer px-4 pt-6 lg:px-0 lg:pt-8">
        <div className="mb-4 h-6 w-24 rounded-full bg-surface" />
        <div className="mb-6 h-40 rounded-xl bg-surface" />
        <div className="mb-4 flex gap-2">
          {[60, 72, 80, 68].map((w) => (
            <div key={w} className="h-8 rounded-full bg-surface" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-surface" />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
