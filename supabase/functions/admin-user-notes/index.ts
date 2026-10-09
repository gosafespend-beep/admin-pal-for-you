import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { emailsFor, errorResponse, HttpError, isUuid, json, requireAdmin } from "../_shared/http.ts";

// Matches the options in UserNotes.tsx.
const TAGS = ["VIP", "Churning", "Spam", "Support", "Potential"];
const MAX_NOTE = 2000;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let requestId: string | undefined;
  try {
    const ctx = await requireAdmin(req, cors);
    if (ctx instanceof Response) return ctx;
    requestId = ctx.meta.requestId;
    const { adminClient } = ctx;

    if (req.method === "GET") {
      const userId = new URL(req.url).searchParams.get("userId");
      if (!isUuid(userId)) throw new HttpError(400, "A valid userId is required");

      const { data, error } = await adminClient
        .from("admin_user_notes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const emails = await emailsFor(adminClient, (data || []).map((n: { admin_id: string }) => n.admin_id));
      const enriched = (data || []).map((note: Record<string, unknown>) => ({
        ...note,
        adminEmail: emails.get(note.admin_id as string) || "Unknown",
      }));
      return json({ data: enriched }, 200, cors);
    }

    if (req.method === "POST") {
      const { userId, note, tag } = await req.json().catch(() => ({}));
      if (!isUuid(userId)) throw new HttpError(400, "A valid userId is required");
      const text = typeof note === "string" ? note.trim() : "";
      if (!text) throw new HttpError(400, "A note is required");
      if (text.length > MAX_NOTE) throw new HttpError(400, `Notes are limited to ${MAX_NOTE} characters`);
      if (tag != null && !TAGS.includes(tag)) throw new HttpError(400, "Unknown tag");

      // Notes can hold personal observations, so they are audited by id and tag
      // only; the text itself stays in the notes table.
      const data = await audited(
        adminClient,
        {
          adminUserId: ctx.adminId,
          action: "add_note",
          targetType: "user",
          targetId: userId,
          details: { tag: tag ?? null, length: text.length },
          meta: ctx.meta,
        },
        async () => {
          const { data, error } = await adminClient
            .from("admin_user_notes")
            .insert({ user_id: userId, admin_id: ctx.adminId, note: text, tag: tag || null })
            .select()
            .single();
          if (error) throw error;
          return data;
        },
      );
      return json({ data }, 201, cors);
    }

    if (req.method === "DELETE") {
      const { noteId } = await req.json().catch(() => ({}));
      if (!isUuid(noteId)) throw new HttpError(400, "A valid noteId is required");

      const { data: existing } = await adminClient
        .from("admin_user_notes")
        .select("user_id, admin_id, tag")
        .eq("id", noteId)
        .maybeSingle();
      if (!existing) throw new HttpError(404, "Note not found");

      await audited(
        adminClient,
        {
          adminUserId: ctx.adminId,
          action: "delete_note",
          targetType: "user",
          targetId: existing.user_id,
          details: { note_id: noteId, note_author: existing.admin_id, tag: existing.tag },
          meta: ctx.meta,
        },
        async () => {
          const { error } = await adminClient.from("admin_user_notes").delete().eq("id", noteId);
          if (error) throw error;
        },
      );
      return json({ success: true }, 200, cors);
    }

    return json({ error: "Method not allowed" }, 405, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-user-notes");
  }
});
