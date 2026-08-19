import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { BOOKMAKERS } from "@/data/bookmakers";
import { SEO_COUNTRIES } from "@/data/country-seo";

const BASE_URL = "https://www.livefoot.fun";

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("SITEMAP_SOURCE_TIMEOUT")), timeoutMs)),
  ]);
}

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  alternates?: SitemapAlternate[];
  image?: string;
}

interface SitemapAlternate {
  language: "fr" | "en" | "x-default";
  path: string;
}

const TRANSLATED_PATHS: Record<string, { fr: string; en: string }> = {
  "/": { fr: "/", en: "/en" },
  "/analyse": { fr: "/analyse", en: "/en/analyse" },
  "/communaute": { fr: "/communaute", en: "/en/community" },
  "/premium": { fr: "/premium", en: "/en/premium" },
  "/blog": { fr: "/blog", en: "/en/blog" },
  "/codes-promo": { fr: "/codes-promo", en: "/en/promo-codes" },
};

function alternatesFor(path: string): SitemapAlternate[] | undefined {
  const pair =
    TRANSLATED_PATHS[path] ??
    Object.values(TRANSLATED_PATHS).find((candidate) => candidate.en === path);
  if (!pair) return undefined;
  return [
    { language: "fr", path: pair.fr },
    { language: "en", path: pair.en },
    { language: "x-default", path: pair.fr },
  ];
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { getEditorialSitemapEntries } = await import("@/lib/editorial.server");
        let editorialEntries: Awaited<ReturnType<typeof getEditorialSitemapEntries>> = [];
        try {
          editorialEntries = await getEditorialSitemapEntries();
        } catch {
          // Un sitemap technique valide reste disponible même sans la base éditoriale.
        }
        const publishedCategories = new Set(
          editorialEntries.filter((entry) => entry.category).map((entry) => entry.category),
        );
        let fixtureEntries: SitemapEntry[] = [];
        try {
          const { getFixtures } = await import("@/lib/football.functions");
          const today = new Date().toISOString().slice(0, 10);
          // Le sitemap ne doit jamais attendre un fournisseur sportif lent.
          // Les fiches réelles restent découvertes par leurs liens et par le
          // prochain rafraîchissement du sitemap.
          const payload = await withTimeout(getFixtures({ data: { date: today } }), 2500);
          if (payload.state !== "unavailable") {
            fixtureEntries = payload.matches
              .filter(
                (match) => match.id > 0 && match.home.name && match.away.name && match.league.name,
              )
              .map((match) => ({
                path: `/live/${match.id}`,
                lastmod: payload.fetchedAt ?? undefined,
                changefreq:
                  match.status === "live" || match.status === "ht"
                    ? ("hourly" as const)
                    : ("daily" as const),
                priority: match.status === "live" || match.status === "ht" ? "0.9" : "0.6",
              }));
          }
        } catch {
          // Le sitemap reste disponible même si le fournisseur sportif est temporairement indisponible.
        }
        // Les fiches match sont incluses uniquement lorsqu’un snapshot réel et
        // exploitable est disponible au moment de construire le sitemap.
        const latestBookmakerUpdate = BOOKMAKERS.reduce(
          (latest, bookmaker) => (bookmaker.updatedAt > latest ? bookmaker.updatedAt : latest),
          "",
        );

        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          { path: "/analyse", changefreq: "weekly", priority: "0.9" },
          { path: "/communaute", changefreq: "daily", priority: "0.8" },
          { path: "/mentions-legales", changefreq: "yearly", priority: "0.3" },
          { path: "/a-propos", changefreq: "monthly", priority: "0.4" },
          { path: "/politique-editoriale", changefreq: "monthly", priority: "0.4" },
          { path: "/premium", changefreq: "monthly", priority: "0.7" },
          { path: "/vip", changefreq: "weekly", priority: "0.8" },
          {
            path: "/codes-promo",
            lastmod: latestBookmakerUpdate,
            changefreq: "weekly",
            priority: "0.9",
          },
          { path: "/blog", changefreq: "daily", priority: "0.9" },
          { path: "/blog/football", lastmod: editorialEntries[0]?.updated_at, changefreq: "daily", priority: "0.85" },
          { path: "/en", changefreq: "weekly", priority: "0.7" },
          { path: "/en/analyse", changefreq: "weekly", priority: "0.7" },
          { path: "/en/premium", changefreq: "monthly", priority: "0.5" },
          { path: "/en/blog", changefreq: "weekly", priority: "0.6" },
          { path: "/en/promo-codes", changefreq: "weekly", priority: "0.7" },
          { path: "/en/community", changefreq: "daily", priority: "0.6" },
          ...Array.from(publishedCategories).map((category) => ({
            path: `/blog/categorie/${category}`,
            changefreq: "daily" as const,
            priority: "0.7",
          })),
          ...editorialEntries.map((article) => ({
            path: `/blog/${article.slug}`,
            lastmod: article.updated_at,
            changefreq: "daily" as const,
            priority: "0.8",
            image: article.cover_image?.startsWith("/") ? `${BASE_URL}${article.cover_image}` : article.cover_image ?? undefined,
          })),
          ...BOOKMAKERS.map((b) => ({
            path: `/codes-promo/${b.slug}`,
            lastmod: b.updatedAt,
            changefreq: "weekly" as const,
            priority: "0.8",
          })),
          ...SEO_COUNTRIES.map((country) => ({
            path: `/codes-promo/${country.slug}`,
            lastmod: latestBookmakerUpdate,
            changefreq: "weekly" as const,
            priority: "0.8",
          })),
          ...BOOKMAKERS.flatMap((bookmaker) =>
            SEO_COUNTRIES.filter((country) =>
              bookmaker.countryPageSlugs?.includes(country.slug),
            ).map((country) => ({
              path: `/codes-promo/${bookmaker.slug}/${country.slug}`,
              lastmod: bookmaker.updatedAt,
              changefreq: "weekly" as const,
              priority: "0.7",
            })),
          ),
          ...fixtureEntries,
        ];

        const uniqueEntries = Array.from(new Map(entries.map((entry) => [entry.path, entry])).values()).map(
          (entry) => ({
            ...entry,
            alternates: entry.alternates ?? alternatesFor(entry.path),
          }),
        );

        const urls = uniqueEntries.map((e) =>
          [
            `  <url>`,
            `    <loc>${xmlEscape(`${BASE_URL}${e.path}`)}</loc>`,
            ...(e.alternates ?? []).map(
              (alternate) =>
                `    <xhtml:link rel="alternate" hreflang="${xmlEscape(alternate.language)}" href="${xmlEscape(`${BASE_URL}${alternate.path}`)}" />`,
            ),
            e.lastmod ? `    <lastmod>${xmlEscape(e.lastmod)}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            e.image ? `    <image:image><image:loc>${xmlEscape(e.image)}</image:loc></image:image>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
