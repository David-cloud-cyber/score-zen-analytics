import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://www.livefoot.fun";

function escapeCdata(value: string) {
  return value.replace(/]]>/g, "]]]]><![CDATA[>");
}

export const Route = createFileRoute("/blog/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { getEditorialFeedEntries } = await import("@/lib/editorial.server");
        const articles = await getEditorialFeedEntries();
        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<rss version="2.0"><channel>',
          "<title><![CDATA[Blog football LiveFoot]]></title>",
          `<link>${SITE}/blog</link>`,
          "<description><![CDATA[Actualités et analyses football vérifiées par LiveFoot.]]></description>",
          ...articles.map(
            (article) =>
              `<item><title><![CDATA[${escapeCdata(article.title)}]]></title><link>${SITE}/blog/${article.slug}</link><guid>${SITE}/blog/${article.slug}</guid><description><![CDATA[${escapeCdata(article.excerpt)}]]></description><pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate></item>`,
          ),
          "</channel></rss>",
        ].join("");
        return new Response(xml, {
          headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            "cache-control": "public, max-age=900",
          },
        });
      },
    },
  },
});
