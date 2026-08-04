import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { BOOKMAKERS } from "@/data/bookmakers";

const BASE_URL = "https://www.livefoot.fun";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // On liste uniquement les routes publiques stables. Les fiches match
        // (/live/$id) ne sont pas listées car leurs IDs API-Football changent
        // en permanence : l'indexation se fait via les liens internes.
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          { path: "/analyse", changefreq: "weekly", priority: "0.9" },
          { path: "/communaute", changefreq: "daily", priority: "0.8" },
          { path: "/mentions-legales", changefreq: "yearly", priority: "0.3" },
          { path: "/premium", changefreq: "monthly", priority: "0.7" },
          { path: "/codes-promo", changefreq: "weekly", priority: "0.9" },
          ...BOOKMAKERS.map((b) => ({
            path: `/codes-promo/${b.slug}`,
            changefreq: "weekly" as const,
            priority: "0.8",
          })),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
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
