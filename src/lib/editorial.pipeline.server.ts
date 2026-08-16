import { z } from "zod";
import { getConfig, getRuntimeEnv } from "./config.server";
import { getOpenRouterKey, getOpenRouterModels, requestOpenRouterJson } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EditorialCategory, EditorialContent } from "./editorial.types";

const db = supabaseAdmin as any;
const DEFAULT_FEEDS = [
  "https://news.google.com/rss/search?q=football%20France%20Afrique&hl=fr&gl=FR&ceid=FR:fr",
  "https://news.google.com/rss/search?q=football%20transferts%20Premier%20League%20Liga&hl=fr&gl=FR&ceid=FR:fr",
  "https://feeds.bbci.co.uk/sport/football/rss.xml",
];

type FeedItem = {
  title: string;
  url: string;
  publisher: string;
  excerpt: string;
  publishedAt: string | null;
};

const draftSchema = z.object({
  category: z.enum(["actualites", "competitions", "forme", "analyse", "guides"]),
  title: z.string().min(35).max(120),
  seoTitle: z.string().min(35).max(65),
  seoDescription: z.string().min(100).max(165),
  excerpt: z.string().min(100).max(260),
  directAnswer: z.string().min(180).max(500),
  summary: z.string().min(100).max(500),
  sections: z
    .array(
      z.object({
        heading: z.string().min(10).max(100),
        paragraphs: z.array(z.string().min(80).max(1200)).min(2).max(5),
        bullets: z.array(z.string().min(15).max(240)).max(6).optional(),
      }),
    )
    .min(4)
    .max(8),
  faq: z
    .array(z.object({ question: z.string().min(15).max(140), answer: z.string().min(40).max(500) }))
    .max(6),
});

const reviewSchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.array(z.string()).max(10).default([]),
});

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function textFromXml(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}(?:[^>]*)>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function parseFeed(xml: string, feedUrl: string): FeedItem[] {
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].map((match) => match[0]);
  return blocks
    .map((block) => {
      const link = tag(block, "link") || block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || "";
      const description = textFromXml(tag(block, "description") || tag(block, "summary")).slice(0, 700);
      const title = textFromXml(tag(block, "title"));
      const source = textFromXml(tag(block, "source")) || new URL(feedUrl).hostname.replace(/^www\./, "");
      const date = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated");
      if (!title || !link) return null;
      return { title, url: link, publisher: source, excerpt: description, publishedAt: date || null };
    })
    .filter((item): item is FeedItem => Boolean(item));
}

async function fetchFeed(url: string): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    return parseFeed(await response.text(), url);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function words(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function safeIso(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function topicKey(title: string) {
  const stop = new Set(["le", "la", "les", "des", "une", "pour", "avec", "dans", "sur", "du", "de", "et", "en", "au", "aux"]);
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stop.has(word))
    .slice(0, 5)
    .join("-");
}

function categoryFor(title: string): EditorialCategory {
  const value = title.toLowerCase();
  if (/bless|compos|forme|absence|joueur/.test(value)) return "forme";
  if (/ligue|coupe|champions|premier league|liga|can|competition/.test(value)) return "competitions";
  if (/stat|probabil|analyse|xg|corner|carton/.test(value)) return "analyse";
  if (/guide|conseil|comprendre|comment/.test(value)) return "guides";
  return "actualites";
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function editorialSlot(now = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour);
  const slot = [7, 13, 19].find((candidate) => hour === candidate);
  return slot ? `${values.year}-${values.month}-${values.day}-${slot}` : null;
}

async function collectSources() {
  const configured = getRuntimeEnv("EDITORIAL_SOURCE_FEEDS")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const feeds = configured?.length ? configured : DEFAULT_FEEDS;
  const batches = await Promise.all(feeds.slice(0, 8).map(fetchFeed));
  const unique = new Map<string, FeedItem>();
  for (const item of batches.flat()) {
    if (!unique.has(item.url)) unique.set(item.url, item);
  }
  return [...unique.values()].filter((item) => !item.publishedAt || Date.now() - new Date(item.publishedAt).getTime() < 72 * 60 * 60_000);
}

async function generateDraft(topic: { title: string; category: EditorialCategory; sources: FeedItem[] }) {
  const apiKey = await getOpenRouterKey();
  if (!apiKey) throw new Error("EDITORIAL_AI_NOT_CONFIGURED");
  const models = getOpenRouterModels();
  const sourceText = topic.sources
    .map((source, index) => `${index + 1}. ${source.title} — ${source.publisher}\nURL: ${source.url}\nRésumé: ${source.excerpt}`)
    .join("\n\n");
  const raw = await requestOpenRouterJson({
    apiKey,
    model: models.premium,
    timeoutMs: 35_000,
    maxTokens: 5_000,
    systemPrompt: `Tu es la rédaction football francophone de LiveFoot. Rédige un article original, factuel et utile pour la France et l'Afrique francophone. Utilise uniquement les faits présents dans les sources fournies. Si une information n'est pas confirmée, ne l'affirme pas. Ne copie aucune phrase source. N'invente ni score, ni blessure, ni cote, ni date, ni déclaration. Réponds uniquement en JSON avec les clés category, title, seoTitle, seoDescription, excerpt, directAnswer, summary, sections et faq. L'article doit expliquer, contextualiser et apporter une lecture data, pas seulement résumer les sources.`,
    userPrompt: `Sujet : ${topic.title}\nCatégorie : ${topic.category}\n\nSources autorisées :\n${sourceText}\n\nRédige un article de 1200 à 1800 mots. Les sections doivent contenir plusieurs paragraphes substantiels.`,
  });
  return draftSchema.parse(raw);
}

async function reviewDraft(draft: z.infer<typeof draftSchema>, sourceText: string) {
  const apiKey = await getOpenRouterKey();
  if (!apiKey) throw new Error("EDITORIAL_AI_NOT_CONFIGURED");
  const models = getOpenRouterModels();
  const raw = await requestOpenRouterJson({
    apiKey,
    model: models.standard,
    timeoutMs: 20_000,
    maxTokens: 900,
    systemPrompt: "Tu es un contrôleur éditorial strict. Vérifie uniquement la fidélité aux sources, la clarté, l'originalité, la structure SEO et l'absence de promesse trompeuse. Réponds en JSON avec approved, score et issues.",
    userPrompt: `Sources :\n${sourceText}\n\nArticle :\n${JSON.stringify(draft)}`,
  });
  return reviewSchema.parse(raw);
}

async function createArticle(topic: { title: string; category: EditorialCategory; sources: FeedItem[]; topicId: string }) {
  const draft = await generateDraft(topic);
  const articleText = [draft.title, draft.excerpt, draft.directAnswer, draft.summary, ...draft.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.bullets ?? [])]), ...draft.faq.flatMap((item) => [item.question, item.answer])].join(" ");
  const wordCount = words(articleText);
  if (wordCount < 900) throw new Error("EDITORIAL_WORD_COUNT_TOO_LOW");
  const sourceText = topic.sources.map((source) => `${source.title} (${source.publisher}) — ${source.excerpt}`).join("\n");
  const review = await reviewDraft(draft, sourceText);
  const qualityScore = Math.round(review.score);
  const slugBase = slugify(draft.title);
  const slug = `${slugBase}-${Date.now().toString(36).slice(-5)}`;
  const articleLinks = [
    { label: "Analyser un match", path: "/analyse", reason: "Comparer deux équipes avec les données LiveFoot" },
    { label: "Voir les matchs en direct", path: "/", reason: "Consulter les rencontres du moment" },
    { label: "Rejoindre la communauté", path: "/communaute", reason: "Comparer les avis des utilisateurs" },
  ];
  const shouldPublish = review.approved && qualityScore >= 80 && wordCount >= 900;
  const { data: article, error } = await db
    .from("editorial_articles")
    .insert({
      topic_id: topic.topicId,
      slug,
      category: draft.category,
      status: shouldPublish ? "published" : "validated",
      title: draft.title,
      seo_title: draft.seoTitle,
      seo_description: draft.seoDescription,
      excerpt: draft.excerpt,
      direct_answer: draft.directAnswer,
      content: { summary: draft.summary, sections: draft.sections, faq: draft.faq } satisfies EditorialContent,
      internal_links: articleLinks,
      quality_score: qualityScore,
      word_count: wordCount,
      author_name: "Rédaction LiveFoot",
      disclosure: "Article préparé à partir de sources publiques citées et vérifié avant publication.",
      published_at: shouldPublish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !article) throw new Error("EDITORIAL_ARTICLE_SAVE_FAILED");
  await db.from("editorial_sources").insert(
    topic.sources.map((source) => ({
      topic_id: topic.topicId,
      article_id: article.id,
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      excerpt: source.excerpt.slice(0, 700),
      published_at: safeIso(source.publishedAt),
      is_verified: true,
    })),
  );
  return { published: shouldPublish, qualityScore, wordCount };
}

export async function runEditorialCycle(options: { force?: boolean; runType?: "scheduled" | "manual" } = {}) {
  const slot = options.force ? `manual-${Date.now()}` : editorialSlot();
  if (!slot) return { skipped: true, reason: "outside_editorial_slot", articlesCreated: 0 };
  const { data: existingRun } = await db.from("editorial_runs").select("id").eq("slot_key", slot).maybeSingle();
  if (existingRun) return { skipped: true, reason: "slot_already_processed", articlesCreated: 0 };
  const { data: run, error: runError } = await db
    .from("editorial_runs")
    .insert({ slot_key: slot, run_type: options.runType ?? "scheduled", status: "running" })
    .select("id")
    .single();
  if (runError || !run) throw new Error("EDITORIAL_RUN_CREATE_FAILED");
  try {
    const rollingDayStart = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: recentArticleCount } = await db
      .from("editorial_articles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", rollingDayStart)
      .in("status", ["validated", "scheduled", "published"]);
    const remainingDailySlots = Math.max(0, 3 - (recentArticleCount ?? 0));
    if (remainingDailySlots === 0) {
      await db.from("editorial_runs").update({ status: "completed", articles_created: 0, metadata: { reason: "daily_limit_reached" }, completed_at: new Date().toISOString() }).eq("id", run.id);
      return { skipped: true, reason: "daily_limit_reached", articlesCreated: 0 };
    }
    const sources = await collectSources();
    const grouped = new Map<string, FeedItem[]>();
    for (const source of sources) {
      const key = topicKey(source.title);
      if (!key) continue;
      grouped.set(key, [...(grouped.get(key) ?? []), source]);
    }
    const candidates = [...grouped.entries()]
      .filter(([, items]) => items.length >= 2)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, Math.min(1, remainingDailySlots));
    let articlesCreated = 0;
    for (const [normalizedKey, topicSources] of candidates) {
      const title = topicSources[0].title;
      const topicCategory = categoryFor(title);
      const { data: topic, error: topicError } = await db
        .from("editorial_topics")
        .upsert({ title, normalized_key: normalizedKey, category: topicCategory, trend_score: topicSources.length, status: "selected", updated_at: new Date().toISOString() }, { onConflict: "normalized_key" })
        .select("id, status")
        .single();
      if (topicError || !topic || topic.status === "used") continue;
      try {
        await createArticle({ title, category: topicCategory, sources: topicSources.slice(0, 5), topicId: topic.id });
        await db.from("editorial_topics").update({ status: "used", updated_at: new Date().toISOString() }).eq("id", topic.id);
        articlesCreated += 1;
      } catch (error) {
        await db.from("editorial_topics").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", topic.id);
        console.warn("Editorial topic rejected:", error instanceof Error ? error.message : error);
      }
    }
    await db.from("editorial_runs").update({ status: "completed", articles_created: articlesCreated, completed_at: new Date().toISOString() }).eq("id", run.id);
    return { skipped: false, articlesCreated };
  } catch (error) {
    await db.from("editorial_runs").update({ status: "failed", error_message: error instanceof Error ? error.message : "Editorial run failed", completed_at: new Date().toISOString() }).eq("id", run.id);
    throw error;
  }
}
