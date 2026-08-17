import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SupportCategory = "payment" | "analysis" | "account" | "premium" | "partner" | "bug" | "other";
export type SupportStatus = "open" | "waiting_support" | "waiting_user" | "resolved" | "closed";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function clean(value: string, max: number) {
  return value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F]/g, " ").trim().slice(0, max);
}

async function requireSupportAdmin(context: any): Promise<"admin" | "owner"> {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "owner"]);
  if (error) throw new Error("ADMIN_ROLE_LOOKUP_FAILED");
  if ((data ?? []).some((item: any) => item.role === "owner")) return "owner";
  if ((data ?? []).some((item: any) => item.role === "admin")) return "admin";
  throw new Error("ADMIN_FORBIDDEN");
}

const ticketInput = z.object({ subject: z.string().trim().min(3).max(120), category: z.enum(["payment", "analysis", "account", "premium", "partner", "bug", "other"]), message: z.string().trim().min(1).max(2000), priority: z.enum(["normal", "high"]).default("normal") });

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ticketInput.parse(input))
  .handler(async ({ data, context }) => {
    const client = await db();
    const since = new Date(Date.now() - 30_000).toISOString();
    const { count } = await client.from("support_tickets").select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", since);
    if ((count ?? 0) > 0) throw new Error("Attendez quelques secondes avant d'ouvrir une autre demande.");
    const { data: ticket, error } = await client.from("support_tickets").insert({ user_id: context.userId, subject: clean(data.subject, 120), category: data.category, priority: data.priority, status: "open" }).select("id, subject, category, priority, status, created_at, updated_at, last_message_at").single();
    if (error || !ticket) throw new Error("Votre demande n'a pas pu être créée.");
    const { error: messageError } = await client.from("support_messages").insert({ ticket_id: ticket.id, author_id: context.userId, author_role: "user", message: clean(data.message, 2000) });
    if (messageError) throw new Error("Votre message n'a pas pu être ajouté.");
    await client.from("support_tickets").update({ last_message_at: new Date().toISOString(), status: "waiting_support" }).eq("id", ticket.id);
    return ticket;
  });

export const getMySupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await db();
    const { data, error } = await client.from("support_tickets").select("id, subject, category, priority, status, created_at, updated_at, last_message_at").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(50);
    if (error) throw new Error("Impossible de charger vos demandes.");
    return data ?? [];
  });

export const getSupportThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const client = await db();
    const { data: ticket } = await client.from("support_tickets").select("id, subject, category, priority, status, created_at, updated_at, last_message_at, user_id").eq("id", data.ticketId).eq("user_id", context.userId).maybeSingle();
    if (!ticket) throw new Error("Demande introuvable.");
    const { data: messages } = await client.from("support_messages").select("id, ticket_id, author_id, author_role, message, created_at").eq("ticket_id", data.ticketId).order("created_at", { ascending: true }).limit(100);
    return { ticket, messages: messages ?? [] };
  });

export const postSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ticketId: z.string().uuid(), message: z.string().trim().min(1).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const client = await db();
    const { data: ticket } = await client.from("support_tickets").select("id, status").eq("id", data.ticketId).eq("user_id", context.userId).maybeSingle();
    if (!ticket || ticket.status === "closed") throw new Error("Cette demande est fermée.");
    const { data: row, error } = await client.from("support_messages").insert({ ticket_id: data.ticketId, author_id: context.userId, author_role: "user", message: clean(data.message, 2000) }).select("id, ticket_id, author_id, author_role, message, created_at").single();
    if (error || !row) throw new Error("Votre réponse n'a pas pu être envoyée.");
    await client.from("support_tickets").update({ status: "waiting_support", last_message_at: new Date().toISOString() }).eq("id", data.ticketId);
    return row;
  });

export const getAdminSupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ status: z.string().default("all") }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await requireSupportAdmin(context);
    const client = await db();
    let query = client.from("support_tickets").select("id, user_id, subject, category, priority, status, assigned_to, created_at, updated_at, last_message_at").order("updated_at", { ascending: false }).limit(100);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: tickets, error } = await query;
    if (error) throw new Error("Impossible de charger le support.");
    return tickets ?? [];
  });

export const getAdminSupportThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSupportAdmin(context);
    const client = await db();
    const { data: ticket } = await client.from("support_tickets").select("*").eq("id", data.ticketId).maybeSingle();
    if (!ticket) throw new Error("Demande introuvable.");
    const { data: messages } = await client.from("support_messages").select("id, ticket_id, author_id, author_role, message, created_at").eq("ticket_id", data.ticketId).order("created_at", { ascending: true }).limit(200);
    return { ticket, messages: messages ?? [] };
  });

export const adminReplySupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ticketId: z.string().uuid(), message: z.string().trim().min(1).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await requireSupportAdmin(context);
    const client = await db();
    const { data: ticket } = await client.from("support_tickets").select("id, user_id, status").eq("id", data.ticketId).maybeSingle();
    if (!ticket) throw new Error("Demande introuvable.");
    const { data: row, error } = await client.from("support_messages").insert({ ticket_id: data.ticketId, author_id: context.userId, author_role: role, message: clean(data.message, 2000) }).select("id, ticket_id, author_id, author_role, message, created_at").single();
    if (error || !row) throw new Error("La réponse n'a pas pu être envoyée.");
    await client.from("support_tickets").update({ status: "waiting_user", last_message_at: new Date().toISOString(), assigned_to: context.userId }).eq("id", data.ticketId);
    await client.from("user_notifications").insert({ user_id: ticket.user_id, type: "support_reply", title: "Réponse du support", message: "Le support a répondu à votre demande.", link: "/support", entity_id: ticket.id });
    return row;
  });

export const setSupportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ticketId: z.string().uuid(), status: z.enum(["open", "waiting_support", "waiting_user", "resolved", "closed"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSupportAdmin(context);
    const client = await db();
    const { error } = await client.from("support_tickets").update({ status: data.status }).eq("id", data.ticketId);
    if (error) throw new Error("Le statut n'a pas pu être mis à jour.");
    return { ok: true };
  });
