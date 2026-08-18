import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export type EnglishSeoSection = {
  title: string;
  text: string;
  bullets?: string[];
};

export function EnglishSeoPage({
  eyebrow,
  title,
  answer,
  sections,
  primaryHref = "/en/analyse",
  primaryLabel = "Open football analysis",
  secondaryHref = "/en",
  secondaryLabel = "Back to LiveFoot",
  children,
}: {
  eyebrow: string;
  title: string;
  answer: string;
  sections: EnglishSeoSection[];
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  children?: ReactNode;
}) {
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-8 lg:px-0">
        <nav aria-label="Breadcrumb" className="text-xs font-bold text-muted-foreground">
          <a href="/en" className="hover:text-foreground">
            LiveFoot
          </a>
          <span className="px-2" aria-hidden>
            ›
          </span>
          <span>{title}</span>
        </nav>
        <header className="max-w-3xl space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">{title}</h1>
          <p data-answer className="text-base leading-relaxed text-muted-foreground">
            {answer}
          </p>
        </header>
        {children}
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-border/70 bg-card p-5"
            >
              <h2 className="text-lg font-black tracking-tight">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.text}</p>
              {section.bullets?.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-border/70 pt-6">
          <a
            href={primaryHref}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-black text-brand-foreground hover:bg-brand/90"
          >
            {primaryLabel}
          </a>
          <a
            href={secondaryHref}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-black text-foreground hover:bg-surface"
          >
            {secondaryLabel}
          </a>
        </div>
      </main>
    </AppShell>
  );
}
