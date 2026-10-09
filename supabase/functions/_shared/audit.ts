/**
 * Shared audit-trail helpers.
 *
 * Two modes:
 *  - logAudit: best-effort. A failed insert is logged but never fails the
 *    action. Fine for low-risk edits such as a blog post.
 *  - logAuditStrict / audited: fail closed. For anything that changes access,
 *    money or personal data, the intent is written FIRST; if that write fails,
 *    the action is not performed. After the action a `_completed` or `_failed`
 *    row records the outcome. The table is append-only (see the pending
 *    migration), so outcomes are new rows rather than updates.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HttpError } from './http.ts'

// deno-lint-ignore no-explicit-any
type AdminClient = any

export interface AuditEntry {
  adminUserId: string | null
  action: string
  targetType: string
  targetId: string
  details?: Record<string, unknown>
  /** ip, user agent and request id of the admin's call, stored under details._meta. */
  meta?: { ip: string | null; userAgent: string | null; requestId: string }
}

export async function getAdminUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data } = await userClient.auth.getUser()
    return data?.user?.id ?? null
  } catch (_e) {
    return null
  }
}

function row(entry: AuditEntry) {
  return {
    admin_user_id: entry.adminUserId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    details: { ...(entry.details ?? {}), ...(entry.meta ? { _meta: entry.meta } : {}) },
  }
}

export async function logAudit(adminClient: AdminClient, entry: AuditEntry): Promise<void> {
  if (!entry.adminUserId) {
    console.warn(`audit: skipped ${entry.action} on ${entry.targetType} - no admin user id`)
    return
  }
  const { error } = await adminClient.from('admin_audit_log').insert(row(entry))
  if (error) console.error('audit: insert failed', error.message)
}

export async function logAuditStrict(adminClient: AdminClient, entry: AuditEntry): Promise<void> {
  if (!entry.adminUserId) throw new HttpError(403, 'Could not identify the admin performing this action')
  const { error } = await adminClient.from('admin_audit_log').insert(row(entry))
  if (error) {
    console.error('audit: strict insert failed', error.message)
    throw new HttpError(500, 'Could not record this action in the audit log, so it was not performed')
  }
}

/** Writes the intent, runs the action, then records how it ended. */
export async function audited<T>(
  adminClient: AdminClient,
  entry: AuditEntry,
  run: () => Promise<T>,
  outcomeDetails?: (result: T) => Record<string, unknown>,
): Promise<T> {
  await logAuditStrict(adminClient, entry)
  try {
    const result = await run()
    await logAudit(adminClient, {
      ...entry,
      action: `${entry.action}_completed`,
      details: { ...(entry.details ?? {}), ...(outcomeDetails ? outcomeDetails(result) : {}) },
    })
    return result
  } catch (error) {
    await logAudit(adminClient, {
      ...entry,
      action: `${entry.action}_failed`,
      details: { ...(entry.details ?? {}), error: error instanceof Error ? error.message : 'unknown' },
    })
    throw error
  }
}
