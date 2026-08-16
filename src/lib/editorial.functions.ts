import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getAdminEditorialData,
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
      })
      .parse(data),
  )
  .handler(({ data }) => getPublishedEditorialIndex(data));

export const getBlogArticle = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().trim().min(2).max(160) }).parse(data))
  .handler(({ data }) => getPublishedEditorialArticle(data.slug));

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
      .select("id, status, quality_score, word_count")
      .eq("id", data.articleId)
      .maybeSingle();
    if (articleError || !article) throw new Error("EDITORIAL_ARTICLE_NOT_FOUND");
    if (data.status === "published" && (Number(article.quality_score ?? 0) < 80 || Number(article.word_count ?? 0) < 900)) {
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
