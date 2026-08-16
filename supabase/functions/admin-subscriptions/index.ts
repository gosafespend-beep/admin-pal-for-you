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

    const { data: { user: adminUser } } = await userClient.auth.getUser()
    const adminUserId = adminUser?.id

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const url = new URL(req.url)

    // POST: Subscription actions (extend trial, cancel, reactivate)
    if (req.method === 'POST') {
      const body = await req.json()
      const { subscriptionId, action, data: actionData } = body

      if (!subscriptionId || !action) {
        return new Response(JSON.stringify({ error: 'subscriptionId and action are required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      let updateData: Record<string, unknown> = {}

      switch (action) {
        case 'extend_trial': {
          const days = actionData?.days || 7
          const { data: sub } = await adminClient.from('subscriptions').select('trial_end').eq('id', subscriptionId).single()
          if (!sub) {
            return new Response(JSON.stringify({ error: 'Subscription not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
          }
          const currentEnd = new Date(sub.trial_end)
          const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000)
          updateData = { trial_end: newEnd.toISOString(), status: 'trialing', updated_at: new Date().toISOString() }
          break
        }
        case 'cancel': {
          updateData = { status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          break
        }
        case 'reactivate': {
          const now = new Date()
          const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          updateData = { 
            status: 'active', 
            cancelled_at: null, 
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString()
          }
          break
        }
        default:
          return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      const { error: updateError } = await adminClient.from('subscriptions').update(updateData).eq('id', subscriptionId)
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      // Audit log
      if (adminUserId) {
        await adminClient.from('admin_audit_log').insert({
          admin_user_id: adminUserId,
          action,
          target_type: 'subscription',
          target_id: subscriptionId,
          details: { updateData },
        })
      }

      return new Response(JSON.stringify({ success: true, message: `Subscription ${action} successful` }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1')
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20')
      const statusFilter = url.searchParams.get('status') || ''
      const search = url.searchParams.get('search') || ''

      let query = adminClient.from('subscriptions').select('*').order('created_at', { ascending: false })

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data: subscriptions, error: subErr } = await query

      if (subErr) {
        return new Response(JSON.stringify({ error: subErr.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const userMap = new Map((users || []).map(u => [u.id, u]))

      let enriched = (subscriptions || []).map(sub => {
        const user = userMap.get(sub.user_id)
        return {
          ...sub,
          userEmail: user?.email || 'Unknown',
          userCreatedAt: user?.created_at,
        }
      })

      if (search) {
        const q = search.toLowerCase()
        enriched = enriched.filter(s => s.userEmail.toLowerCase().includes(q))
      }

      const total = enriched.length
      const offset = (page - 1) * pageSize
      const paginated = enriched.slice(offset, offset + pageSize)

      const stats = {
        total: (subscriptions || []).length,
        active: (subscriptions || []).filter(s => s.status === 'active').length,
        trialing: (subscriptions || []).filter(s => s.status === 'trialing').length,
        cancelled: (subscriptions || []).filter(s => s.status === 'cancelled').length,
        expired: (subscriptions || []).filter(s => s.status === 'expired').length,
      }

      return new Response(JSON.stringify({ subscriptions: paginated, total, stats }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('admin-subscriptions error:', error)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
