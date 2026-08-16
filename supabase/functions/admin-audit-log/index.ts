import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFor, forbidden } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')
    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const page = parseInt(url.searchParams.get('page') || '1')
      const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '30'), 100)
      const action = url.searchParams.get('action') || ''
      const targetType = url.searchParams.get('targetType') || ''
      const offset = (page - 1) * pageSize

      let query = adminClient.from('admin_audit_log').select('*', { count: 'exact' })
      if (action) query = query.eq('action', action)
      if (targetType) query = query.eq('target_type', targetType)
      query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)

      const { data, count, error } = await query
      if (error) throw error

      // Enrich with admin emails
      const adminIds = [...new Set((data || []).map((l: { admin_user_id: string }) => l.admin_user_id))]
      const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const userMap = new Map((users || []).map(u => [u.id, u.email]))

      const enriched = (data || []).map((entry: Record<string, unknown>) => ({
        ...entry,
        adminEmail: userMap.get(entry.admin_user_id as string) || 'Unknown',
      }))

      return new Response(JSON.stringify({ data: enriched, total: count || 0, page, pageSize }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('admin-audit-log error:', error)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
