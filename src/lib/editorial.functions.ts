import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getAdminEditorialData,
  getFeaturedEditorialArticles,
  getPublishedEditorialArticle,
  getPublishedEditorialIndex,
} from "./editorial.server";
import { runEditorialCycle } from "./editorial.pipeline.server";

const db = supabaseAdmin as any;

async function requireAdmin(context: any) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", ["admin", "owner"]);
  if (error || !data?.length) throw new Error("ADMIN_FORBIDDEN");
  return data.some((row: { role: string }) => row.role === "owner") ? "owner" : "admin";
}

export const getBlogIndex = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        page: z.number().int().min(1).max(100).default(1),
        category: z.string().trim().max(30).optional(),
        query: z.string().trim().max(80).optional(),
        sort: z.enum(["newest", "useful"]).default("newest"),
      })
      .parse(data),
  )
  .handler(({ data }) => getPublishedEditorialIndex(data));

export const getBlogArticle = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().trim().min(2).max(160) }).parse(data))
  .handler(({ data }) => getPublishedEditorialArticle(data.slug));

export const getFeaturedArticles = createServerFn({ method: "GET" }).handler(() => getFeaturedEditorialArticles());

export const getMyEditorialState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ articleId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [{ data: favorite }, { data: progress }] = await Promise.all([
      db.from("editorial_favorites").select("id").eq("user_id", context.userId).eq("article_id", data.articleId).maybeSingle(),
      db.from("editorial_reading_progress").select("progress_percent, last_position, last_read_at").eq("user_id", context.userId).eq("article_id", data.articleId).maybeSingle(),
    ]);
    return {
      isFavorite: Boolean(favorite),
      progress: progress
        ? { percent: Number(progress.progress_percent ?? 0), position: Number(progress.last_position ?? 0), lastReadAt: progress.last_read_at }
        : null,
    };
  });

export const toggleEditorialFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ articleId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: article } = await db.from("editorial_articles").select("id").eq("id", data.articleId).eq("status", "published").maybeSingle();
    if (!article) throw new Error("EDITORIAL_ARTICLE_NOT_FOUND");
    const { data: existing } = await db.from("editorial_favorites").select("id").eq("user_id", context.userId).eq("article_id", data.articleId).maybeSingle();
    if (existing) {
      const { error } = await db.from("editorial_favorites").delete().eq("id", existing.id).eq("user_id", context.userId);
      if (error) throw new Error("EDITORIAL_FAVORITE_UPDATE_FAILED");
      return { isFavorite: false };
    }
    const { error } = await db.from("editorial_favorites").insert({ user_id: context.userId, article_id: data.articleId });
    if (error) throw new Error("EDITORIAL_FAVORITE_UPDATE_FAILED");
    return { isFavorite: true };
  });

export const saveEditorialProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ articleId: z.string().uuid(), position: z.number().int().min(0).max(10_000_000), percent: z.number().min(0).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await db.from("editorial_reading_progress").upsert({
      user_id: context.userId,
      article_id: data.articleId,
      progress_percent: Math.round(data.percent * 100) / 100,
      last_position: data.position,
      last_read_at: new Date().toISOString(),
    }, { onConflict: "user_id,article_id" });
    if (error) throw new Error("EDITORIAL_PROGRESS_SAVE_FAILED");
    return { ok: true };
  });

const reactionSchema = z.enum(["👍", "❤️", "🔥", "⚽", "👏"]);

export const getEditorialComments = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ articleId: z.string().uuid(), page: z.number().int().min(1).max(100).default(1) }).parse(data))
  .handler(async ({ data }) => {
    const pageSize = 20;
    const { data: rows, error, count } = await db.from("editorial_comments")
      .select("id, article_id, user_id, parent_id, body, created_at", { count: "exact" })
      .eq("article_id", data.articleId)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .range((data.page - 1) * pageSize, data.page * pageSize - 1);
    if (error) throw new Error("EDITORIAL_COMMENTS_UNAVAILABLE");
    const comments = (rows ?? []) as Array<Record<string, any>>;
    const ids = comments.map((row) => String(row.id));
    const userIds = [...new Set(comments.map((row) => String(row.user_id)))];
    const [{ data: profiles }, { data: reactions }] = await Promise.all([
      userIds.length ? db.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
      ids.length ? db.from("editorial_comment_reactions").select("comment_id, reaction").in("comment_id", ids) : Promise.resolve({ data: [] }),
    ]);
    const names = new Map<string, string>((profiles ?? []).map((profile: any) => [String(profile.id), String(profile.display_name || "Membre LiveFoot").slice(0, 80)] as [string, string]));
    const counts = new Map<string, Record<string, number>>();
    for (const reaction of reactions ?? []) {
      const key = String(reaction.comment_id);
      const current = counts.get(key) ?? {};
      current[String(reaction.reaction)] = (current[String(reaction.reaction)] ?? 0) + 1;
      counts.set(key, current);
    }
    return {
      comments: comments.map((row) => ({
        id: String(row.id),
        articleId: String(row.article_id),
        userId: "",
        parentId: row.parent_id ? String(row.parent_id) : null,
        body: String(row.body),
        createdAt: String(row.created_at),
        authorName: names.get(String(row.user_id)) ?? "Membre LiveFoot",
        reactions: counts.get(String(row.id)) ?? {},
      })),
      page: data.page,
      hasMore: comments.length === pageSize,
      total: count ?? comments.length,
    };
  });

export const postEditorialComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ articleId: z.string().uuid(), parentId: z.string().uuid().nullable().optional(), content: z.string().trim().min(2).max(1200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: article } = await db.from("editorial_articles").select("id").eq("id", data.articleId).eq("status", "published").maybeSingle();
    if (!article) throw new Error("EDITORIAL_ARTICLE_NOT_FOUND");
    const recentSince = new Date(Date.now() - 30_000).toISOString();
    const { count: recentCount } = await db.from("editorial_comments").select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", recentSince);
    if ((recentCount ?? 0) > 0) throw new Error("EDITORIAL_COMMENT_RATE_LIMIT");
    if (data.parentId) {
      const { data: parent } = await db.from("editorial_comments").select("id, article_id, parent_id, user_id").eq("id", data.parentId).eq("article_id", data.articleId).maybeSingle();
      if (!parent || parent.parent_id) throw new Error("EDITORIAL_COMMENT_DEPTH_INVALID");
    }
    const { data: profile } = await db.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
    const { data: row, error } = await db.from("editorial_comments").insert({ article_id: data.articleId, user_id: context.userId, parent_id: data.parentId ?? null, body: data.content, status: "pending" }).select("id, article_id, parent_id, body, created_at").single();
    if (error || !row) throw new Error("EDITORIAL_COMMENT_SAVE_FAILED");
    if (data.parentId) {
      const { data: parent } = await db.from("editorial_comments").select("user_id").eq("id", data.parentId).maybeSingle();
      if (parent?.user_id && parent.user_id !== context.userId) {
        await db.from("user_notifications").insert({ user_id: parent.user_id, type: "editorial_reply", title: "Nouvelle réponse", message: `${String(profile?.display_name || "Un membre").slice(0, 80)} a répondu à votre commentaire.`, link: `/blog`, entity_id: data.articleId });
      }
    }
    return { ok: true, status: "pending", id: row.id, message: "Votre commentaire sera visible après vérification." };
  });

export const getAdminEditorialComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data: rows, error } = await db.from("editorial_comments").select("id, article_id, user_id, body, status, created_at, moderation_reason").order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("EDITORIAL_COMMENTS_UNAVAILABLE");
    const userIds = [...new Set((rows ?? []).map((row: any) => String(row.user_id)))];
    const { data: profiles } = userIds.length ? await db.from("profiles").select("id, display_name").in("id", userIds) : { data: [] };
    const names = new Map<string, string>((profiles ?? []).map((profile: any) => [String(profile.id), String(profile.display_name || "Membre LiveFoot").slice(0, 80)] as [string, string]));
    return (rows ?? []).map((row: any) => ({ id: String(row.id), articleId: String(row.article_id), authorName: names.get(String(row.user_id)) ?? "Membre LiveFoot", body: String(row.body), status: String(row.status), reason: row.moderation_reason ? String(row.moderation_reason) : null, createdAt: String(row.created_at) }));
  });

export const toggleEditorialReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ commentId: z.string().uuid(), reaction: reactionSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: comment } = await db.from("editorial_comments").select("id").eq("id", data.commentId).eq("status", "approved").maybeSingle();
    if (!comment) throw new Error("EDITORIAL_COMMENT_NOT_FOUND");
    const { data: existing } = await db.from("editorial_comment_reactions").select("id").eq("comment_id", data.commentId).eq("user_id", context.userId).eq("reaction", data.reaction).maybeSingle();
    if (existing) await db.from("editorial_comment_reactions").delete().eq("id", existing.id).eq("user_id", context.userId);
    else await db.from("editorial_comment_reactions").insert({ comment_id: data.commentId, user_id: context.userId, reaction: data.reaction });
    const { data: rows } = await db.from("editorial_comment_reactions").select("reaction").eq("comment_id", data.commentId);
    return { active: !existing, reactions: (rows ?? []).reduce((acc: Record<string, number>, item: any) => { acc[String(item.reaction)] = (acc[String(item.reaction)] ?? 0) + 1; return acc; }, {}) };
  });

export const reportEditorialComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ commentId: z.string().uuid(), reason: z.string().trim().min(3).max(240) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await db.from("editorial_comment_reports").insert({ comment_id: data.commentId, reporter_id: context.userId, reason: data.reason });
    if (error && !String(error.code).includes("23505")) throw new Error("EDITORIAL_REPORT_FAILED");
    return { ok: true };
  });

export const moderateEditorialComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ commentId: z.string().uuid(), status: z.enum(["approved", "hidden", "spam"]), reason: z.string().trim().min(3).max(240).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const role = await requireAdmin(context);
    const { data: comment, error: readError } = await db.from("editorial_comments").select("id, user_id").eq("id", data.commentId).maybeSingle();
    if (readError || !comment) throw new Error("EDITORIAL_COMMENT_NOT_FOUND");
    const { error } = await db.from("editorial_comments").update({ status: data.status, moderation_reason: data.reason ?? null, moderated_by: context.userId, moderated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", data.commentId);
    if (error) throw new Error("EDITORIAL_MODERATION_FAILED");
    if (comment.user_id !== context.userId) await db.from("user_notifications").insert({ user_id: comment.user_id, type: "editorial_moderation", title: "Mise à jour de votre commentaire", message: data.status === "approved" ? "Votre commentaire est maintenant visible." : "Votre commentaire a été masqué après vérification.", link: "/blog", entity_id: data.commentId });
    return { ok: true, role };
  });

export const getAdminEditorialQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    return getAdminEditorialData();
  });

export const setAdminEditorialStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        articleId: z.string().uuid(),
        status: z.enum(["validated", "scheduled", "published", "rejected"]),
        reason: z.string().trim().min(8).max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const role = await requireAdmin(context);
    const { data: article, error: articleError } = await db
      .from("editorial_articles")
      .select("id, status, quality_score, word_count, cover_image, cover_alt")
      .eq("id", data.articleId)
      .maybeSingle();
    if (articleError || !article) throw new Error("EDITORIAL_ARTICLE_NOT_FOUND");
    if (data.status === "published" && (Number(article.quality_score ?? 0) < 80 || Number(article.word_count ?? 0) < 1500 || Number(article.word_count ?? 0) > 2500 || !article.cover_image || !article.cover_alt)) {
      throw new Error("EDITORIAL_QUALITY_GATE_FAILED");
    }
    const patch: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
      rejection_reason: data.status === "rejected" ? data.reason ?? "Rejet éditorial" : null,
    };
    if (data.status === "published") patch.published_at = new Date().toISOString();
    if (data.status === "scheduled") patch.scheduled_for = new Date(Date.now() + 60 * 60_000).toISOString();
    const { error } = await db.from("editorial_articles").update(patch).eq("id", data.articleId);
    if (error) throw new Error("EDITORIAL_STATUS_UPDATE_FAILED");
    await db.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: `editorial.article.${data.status}`,
      target_type: "editorial_article",
      target_id: data.articleId,
      reason: data.reason ?? null,
      before_state: article,
      after_state: { ...article, ...patch },
      metadata: { role },
    });
    return { ok: true };
  });

export const runAdminEditorialCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    return runEditorialCycle({ force: true, runType: "manual" });
  });
