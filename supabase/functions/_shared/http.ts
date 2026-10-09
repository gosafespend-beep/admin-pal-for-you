/**
 * Small shared helpers for the admin edge functions.
 *
 * Every function used to repeat the same JWT-and-is_admin boilerplate, parse
 * pagination with a bare parseInt, build PostgREST filters by interpolating the
 * search box, and return raw error messages to the browser. These helpers do
 * each of those once. (A fuller middleware with permissions and audit is the
 * next step; see ADMIN_PANEL_AUDIT_AND_PLAN.)
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
export type AnyClient = SupabaseClient<any, any, any>;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Parses a query value as an integer within [min, max], falling back to `def`. */
export function clampInt(value: string | null | undefined, def: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

/** Escapes LIKE/ILIKE wildcards so a search for `50%` means a literal 50%. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Makes a search term safe to embed inside a PostgREST `.or()` filter string,
 * where commas, parentheses and quotes are syntax. They are replaced by spaces
 * (a search box has no use for them) and LIKE wildcards are escaped.
 */
export function orSearchTerm(term: string): string {
  return escapeLike(term.replace(/[,()"'\\]/g, " ").trim().slice(0, 100));
}

export interface AdminContext {
  adminId: string;
  adminEmail: string | null;
  adminClient: AnyClient;
  userClient: AnyClient;
  meta: { ip: string | null; userAgent: string | null; requestId: string };
}

/**
 * Verifies the caller is an admin. Returns the context, or a ready-made
 * Response (401/403) the caller should return as-is.
 */
export async function requireAdmin(req: Request, cors: Record<string, string>): Promise<AdminContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No authorization header" }, 401, cors);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: isAdmin, error } = await userClient.rpc("is_admin");
  if (error || !isAdmin) return json({ error: "Access denied" }, 403, cors);

  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: "Access denied" }, 403, cors);

  const forwarded = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for");
  return {
    adminId: userData.user.id,
    adminEmail: userData.user.email ?? null,
    userClient,
    adminClient: createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    meta: {
      ip: forwarded ? forwarded.split(",")[0].trim() : null,
      userAgent: req.headers.get("user-agent"),
      requestId: crypto.randomUUID(),
    },
  };
}

/**
 * Converts a thrown value into a response. Deliberate HttpErrors keep their
 * message; anything else is logged with a request id and returned generically,
 * so database and library error text never reaches the browser.
 */
export function errorResponse(error: unknown, cors: Record<string, string>, requestId?: string, label = "admin"): Response {
  if (error instanceof HttpError) return json({ error: error.message }, error.status, cors);
  const id = requestId ?? crypto.randomUUID();
  console.error(`[${label}] ${id}`, error);
  return json({ error: "Something went wrong. Please try again.", requestId: id }, 500, cors);
}

/** Every auth user, paging through the admin API instead of stopping at 1,000. */
export async function listAllUsers(adminClient: AnyClient, maxPages = 20) {
  // deno-lint-ignore no-explicit-any
  const users: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data?.users ?? []));
    if (!data?.users || data.users.length < 1000) break;
  }
  return users;
}

/** Looks up emails for a small set of user ids without listing every user. */
export async function emailsFor(adminClient: AnyClient, ids: string[]): Promise<Map<string, string | undefined>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (id) => {
      const { data } = await adminClient.auth.admin.getUserById(id);
      return [id, data?.user?.email] as const;
    }),
  );
  return new Map(entries);
}

/** Reads every row of a table in 1,000-row pages (PostgREST silently caps a single request). */
// deno-lint-ignore no-explicit-any
export async function selectAll(adminClient: AnyClient, table: string, columns: string): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await adminClient.from(table).select(columns).range(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}
