/**
 * Shared audit-trail helper.
 *
 * Every mutating admin action must leave a row in admin_audit_log. Writes are
 * best-effort: a failed audit insert is logged but never fails the action the
 * admin asked for.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// deno-lint-ignore no-explicit-any
type AdminClient = any

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

export async function logAudit(
  adminClient: AdminClient,
  entry: {
    adminUserId: string | null
    action: string
    targetType: string
    targetId: string
    details?: Record<string, unknown>
  },
): Promise<void> {
  if (!entry.adminUserId) {
    console.warn(`audit: skipped ${entry.action} on ${entry.targetType} - no admin user id`)
    return
  }
  const { error } = await adminClient.from('admin_audit_log').insert({
    admin_user_id: entry.adminUserId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    details: entry.details ?? {},
  })
  if (error) console.error('audit: insert failed', error.message)
}
