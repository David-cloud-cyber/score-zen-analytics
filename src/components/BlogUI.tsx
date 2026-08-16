import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, CheckCircle2, ExternalLink, FileText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { EditorialCategory, EditorialListItem, PublicEditorialArticle } from "@/lib/editorial.types";

export const BLOG_CATEGORY_LABELS: Record<EditorialCategory, string> = {
  actualites: "Actualités football",
  competitions: "Compétitions",
  forme: "Forme et effectifs",
  analyse: "Analyse statistique",
  guides: "Guides football",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(value),
  );
}

export function BlogCard({ article }: { article: EditorialListItem }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-border/70 bg-card p-5 transition-transform hover:-translate-y-0.5">
      {article.coverImage ? (
        <img
          src={article.coverImage}
          alt={article.title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="mb-4 aspect-[16/9] w-full rounded-xl object-cover"
        />
      ) : null}
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand">
        <FileText className="size-3.5" aria-hidden />
        {BLOG_CATEGORY_LABELS[article.category]}
      </div>
      <h2 className="mt-3 text-lg font-black leading-tight tracking-tight">{article.title}</h2>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{article.excerpt}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden />
          {formatDate(article.publishedAt)}
        </span>
        <Link
          to="/blog/$slug"
          params={{ slug: article.slug }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 font-black text-brand-foreground"
        >
          Lire
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function BlogIndexEmpty() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-8 text-center">
      <FileText className="mx-auto size-8 text-brand" aria-hidden />
      <h2 className="mt-3 text-lg font-black">Les prochains articles arrivent bientôt</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
        La rédaction prépare des contenus football vérifiés, avec leurs sources et des analyses utiles.
      </p>
    </div>
  );
}

export function BlogArticleView({ article }: { article: PublicEditorialArticle }) {
  return (
    <AppShell>
      <article className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-8 lg:px-0">
        <header className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand">
            <span>{BLOG_CATEGORY_LABELS[article.category]}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Mis à jour le {formatDate(article.updatedAt)}</span>
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">{article.title}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{article.excerpt}</p>
          {article.coverImage ? (
            <img
              src={article.coverImage}
              alt={article.title}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              className="aspect-[16/7] w-full rounded-2xl border border-border/70 object-cover"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{article.authorName}</span>
            <span>·</span>
            <span>{article.wordCount.toLocaleString("fr-FR")} mots</span>
            {article.qualityScore !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 font-bold text-brand">
                <CheckCircle2 className="size-3.5" aria-hidden />
                Informations vérifiées
              </span>
            )}
          </div>
        </header>

        <aside className="rounded-2xl border border-brand/30 bg-brand/5 p-5" data-answer>
          <p className="text-[10px] font-black uppercase tracking-widest text-brand">Réponse directe</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed">{article.directAnswer}</p>
        </aside>

        <nav aria-label="Dans cet article" className="rounded-2xl border border-border/70 bg-surface p-5">
          <p className="text-xs font-black uppercase tracking-widest">Dans cet article</p>
          <ol className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {article.content.sections.map((section, index) => (
              <li key={section.heading}>
                <a href={`#section-${index + 1}`} className="hover:text-brand">
                  {index + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <p className="text-base leading-8">{article.content.summary}</p>

        {article.content.sections.map((section, index) => (
          <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-24 space-y-4">
            <h2 className="text-2xl font-black tracking-tight">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-foreground/90">
                {paragraph}
              </p>
            ))}
            {section.bullets?.length ? (
              <ul className="space-y-2 rounded-xl bg-surface p-4 text-sm leading-relaxed">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        {article.internalLinks.length > 0 && (
          <aside className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-brand">À découvrir sur LiveFoot</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {article.internalLinks.map((link) => (
                <Link key={`${link.path}-${link.label}`} to={link.path as never} className="rounded-xl bg-brand px-3 py-2 text-xs font-black text-brand-foreground">
                  {link.label}
                </Link>
              ))}
            </div>
          </aside>
        )}

        {article.content.faq.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-2xl font-black tracking-tight">Questions fréquentes</h2>
            {article.content.faq.map((item) => (
              <details key={item.question} className="rounded-xl border border-border/70 bg-card p-4">
                <summary className="cursor-pointer text-sm font-black">{item.question}</summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </section>
        )}

        {article.relatedArticles?.length ? (
          <section aria-labelledby="related-articles" className="space-y-4 border-t border-border/70 pt-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand">Pour continuer</p>
              <h2 id="related-articles" className="mt-1 text-2xl font-black tracking-tight">À lire aussi</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Retrouvez d’autres articles utiles pour mieux comprendre les matchs, les équipes et les données football.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {article.relatedArticles.map((related) => <BlogCard key={related.id} article={related} />)}
            </div>
          </section>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-border/70 bg-surface p-5">
          <h2 className="text-lg font-black">Sources et transparence</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cet article s’appuie sur les sources listées ci-dessous. Les informations peuvent évoluer : vérifiez toujours les communications officielles avant de prendre une décision.
          </p>
          <ul className="space-y-2">
            {article.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">
                  {source.publisher} — {source.title}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          {article.disclosure && <p className="text-xs text-muted-foreground">{article.disclosure}</p>}
        </section>
      </article>
    </AppShell>
  );
}
