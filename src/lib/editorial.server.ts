import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  EditorialCategory,
  EditorialContent,
  EditorialListItem,
  EditorialSource,
  PublicEditorialArticle,
} from "./editorial.types";

const db = supabaseAdmin as any;

function category(value: unknown): EditorialCategory {
  return ["actualites", "competitions", "forme", "analyse", "guides"].includes(String(value))
    ? (value as EditorialCategory)
    : "actualites";
}

function content(value: unknown): EditorialContent {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const sections = Array.isArray(item.sections)
    ? item.sections
        .map((section) => {
          const row = section && typeof section === "object" ? (section as Record<string, unknown>) : {};
          return {
            heading: typeof row.heading === "string" ? row.heading : "",
            paragraphs: Array.isArray(row.paragraphs)
              ? row.paragraphs.filter((text): text is string => typeof text === "string")
              : [],
            bullets: Array.isArray(row.bullets)
              ? row.bullets.filter((text): text is string => typeof text === "string")
              : undefined,
          };
        })
        .filter((section) => section.heading && section.paragraphs.length > 0)
    : [];
  const faq = Array.isArray(item.faq)
    ? item.faq
        .map((entry) => {
          const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
          return {
            question: typeof row.question === "string" ? row.question : "",
            answer: typeof row.answer === "string" ? row.answer : "",
          };
        })
        .filter((entry) => entry.question && entry.answer)
    : [];
  return {
    summary: typeof item.summary === "string" ? item.summary : "",
    sections,
    faq,
  };
}

function sources(rows: unknown[]): EditorialSource[] {
  return rows.map((value) => {
    const row = value as Record<string, unknown>;
    return {
      id: typeof row.id === "string" ? row.id : undefined,
      title: String(row.title ?? "Source éditoriale"),
      url: String(row.url ?? ""),
      publisher: String(row.publisher ?? "Source vérifiée"),
      excerpt: typeof row.excerpt === "string" ? row.excerpt : null,
      publishedAt: typeof row.published_at === "string" ? row.published_at : null,
      verified: row.is_verified === true,
    };
  });
}

function mapArticle(row: Record<string, unknown>, sourceRows: unknown[] = []): PublicEditorialArticle {
  return {
    id: String(row.id),
    slug: String(row.slug),
    category: category(row.category),
    title: String(row.title),
    seoTitle: String(row.seo_title),
    seoDescription: String(row.seo_description),
    excerpt: String(row.excerpt),
    directAnswer: String(row.direct_answer),
    content: content(row.content),
    internalLinks: Array.isArray(row.internal_links) ? row.internal_links : [],
    qualityScore: typeof row.quality_score === "number" ? row.quality_score : null,
    wordCount: Number(row.word_count ?? 0),
    authorName: String(row.author_name ?? "Rédaction LiveFoot"),
    coverImage: typeof row.cover_image === "string" ? row.cover_image : null,
    disclosure: typeof row.disclosure === "string" ? row.disclosure : null,
    publishedAt: String(row.published_at ?? row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    sources: sources(sourceRows),
  };
}

function mapListItem(row: Record<string, unknown>): EditorialListItem {
  return {
    id: String(row.id),
    slug: String(row.slug),
    category: category(row.category),
    title: String(row.title),
    seoDescription: String(row.seo_description ?? ""),
    excerpt: String(row.excerpt ?? ""),
    wordCount: Number(row.word_count ?? 0),
    coverImage: typeof row.cover_image === "string" ? row.cover_image : null,
    publishedAt: String(row.published_at ?? row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

const PUBLIC_COLUMNS =
  "id, slug, category, title, seo_title, seo_description, excerpt, direct_answer, content, internal_links, quality_score, word_count, author_name, cover_image, disclosure, published_at, updated_at";

export async function getPublishedEditorialIndex(input: {
  page?: number;
  pageSize?: number;
  category?: string;
}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(24, Math.max(1, input.pageSize ?? 12));
  let query = db
    .from("editorial_articles")
    .select(PUBLIC_COLUMNS)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (input.category) query = query.eq("category", input.category);
  const { data, error } = await query;
  if (error) throw new Error("EDITORIAL_INDEX_UNAVAILABLE");
  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    articles: rows.map((row) => mapArticle(row)),
    page,
    pageSize,
    hasMore: rows.length === pageSize,
  };
}

export async function getPublishedEditorialArticle(slug: string) {
  const { data: row, error } = await db
    .from("editorial_articles")
    .select(PUBLIC_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error("EDITORIAL_ARTICLE_UNAVAILABLE");
  if (!row) return null;
  const { data: sourceRows, error: sourceError } = await db
    .from("editorial_sources")
    .select("id, title, url, publisher, excerpt, published_at, is_verified")
    .eq("article_id", row.id)
    .order("published_at", { ascending: false });
  if (sourceError) throw new Error("EDITORIAL_SOURCES_UNAVAILABLE");
  const article = mapArticle(row as Record<string, unknown>, sourceRows ?? []);
  const { data: relatedRows } = await db
    .from("editorial_articles")
    .select(PUBLIC_COLUMNS)
    .eq("status", "published")
    .neq("id", row.id)
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(12);

  const relatedArticles = (relatedRows ?? [])
    .map((related: Record<string, unknown>) => ({ article: mapListItem(related), sameCategory: category(related.category) === article.category }))
    .sort((left, right) => Number(right.sameCategory) - Number(left.sameCategory))
    .slice(0, 3)
    .map(({ article: related }) => related);

  return { ...article, relatedArticles };
}

export async function getEditorialSitemapEntries() {
  const { data, error } = await db
    .from("editorial_articles")
    .select("slug, category, published_at, updated_at")
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (error) throw new Error("EDITORIAL_SITEMAP_UNAVAILABLE");
  return (data ?? []) as Array<{ slug: string; category: string; published_at: string; updated_at: string }>;
}

export async function getEditorialFeedEntries() {
  const { data, error } = await db
    .from("editorial_articles")
    .select(PUBLIC_COLUMNS)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("EDITORIAL_FEED_UNAVAILABLE");
  return (data ?? []).map((row: Record<string, unknown>) => mapArticle(row)) as EditorialListItem[];
}

export async function getAdminEditorialData() {
  const [{ data: articles }, { data: topics }, { data: runs }] = await Promise.all([
    db
      .from("editorial_articles")
      .select("id, slug, title, category, status, quality_score, word_count, scheduled_for, published_at, updated_at, rejection_reason, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("editorial_topics")
      .select("id, title, category, trend_score, status, created_at")
      .order("trend_score", { ascending: false })
      .limit(30),
    db
      .from("editorial_runs")
      .select("id, slot_key, run_type, status, articles_created, error_message, started_at, completed_at")
      .order("started_at", { ascending: false })
      .limit(20),
  ]);
  return { articles: articles ?? [], topics: topics ?? [], runs: runs ?? [] };
}
