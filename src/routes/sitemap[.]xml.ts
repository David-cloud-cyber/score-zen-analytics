import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { BOOKMAKERS } from "@/data/bookmakers";
import { SEO_COUNTRIES } from "@/data/country-seo";

const BASE_URL = "https://www.livefoot.fun";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { getEditorialSitemapEntries } = await import("@/lib/editorial.server");
        const editorialEntries = await getEditorialSitemapEntries();
        // On liste uniquement les routes publiques stables. Les fiches match
        // (/live/$id) ne sont pas listées car leurs IDs API-Football changent
        // en permanence : l'indexation se fait via les liens internes.
        const latestBookmakerUpdate = BOOKMAKERS.reduce(
          (latest, bookmaker) => (bookmaker.updatedAt > latest ? bookmaker.updatedAt : latest),
          "",
        );

        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          { path: "/analyse", changefreq: "weekly", priority: "0.9" },
          { path: "/communaute", changefreq: "daily", priority: "0.8" },
          { path: "/mentions-legales", changefreq: "yearly", priority: "0.3" },
          { path: "/premium", changefreq: "monthly", priority: "0.7" },
          { path: "/codes-promo", lastmod: latestBookmakerUpdate, changefreq: "weekly", priority: "0.9" },
          { path: "/blog", changefreq: "daily", priority: "0.9" },
          ...editorialEntries.map((article) => ({
            path: `/blog/${article.slug}`,
            lastmod: article.updated_at,
            changefreq: "daily" as const,
            priority: "0.8",
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
            SEO_COUNTRIES
              .filter((country) => bookmaker.countryPageSlugs?.includes(country.slug))
              .map((country) => ({
                path: `/codes-promo/${bookmaker.slug}/${country.slug}`,
                lastmod: bookmaker.updatedAt,
                changefreq: "weekly" as const,
                priority: "0.7",
              })),
          ),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
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
