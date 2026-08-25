import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFor, forbidden } from "../_shared/guard.ts";
import { logAudit } from "../_shared/audit.ts";

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
    const { data: { user: currentAdmin } } = await userClient.auth.getUser()
    const currentAdminId = currentAdmin?.id ?? null
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'health'

    if (req.method === 'GET' && action === 'health') {
      // System health checks
      const checks: Record<string, { status: string; latency?: number; details?: string }> = {}

      // Database check
      const dbStart = Date.now()
      const { error: dbError } = await adminClient.from('profiles').select('id', { count: 'exact', head: true })
      checks.database = {
        status: dbError ? 'error' : 'healthy',
        latency: Date.now() - dbStart,
        details: dbError ? dbError.message : undefined,
      }

      // Auth check
      const authStart = Date.now()
      const { error: authErr } = await adminClient.auth.admin.listUsers({ perPage: 1 })
      checks.authentication = {
        status: authErr ? 'error' : 'healthy',
        latency: Date.now() - authStart,
        details: authErr ? authErr.message : undefined,
      }

      // Storage check
      const storageStart = Date.now()
      const { error: storageErr } = await adminClient.storage.listBuckets()
      checks.storage = {
        status: storageErr ? 'error' : 'healthy',
        latency: Date.now() - storageStart,
        details: storageErr ? storageErr.message : undefined,
      }

      // Edge functions check (self-referential - if we got here, functions work)
      checks.edgeFunctions = { status: 'healthy', latency: 0 }

      return new Response(JSON.stringify({ checks, timestamp: new Date().toISOString() }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'GET' && action === 'admins') {
      // List all admins
      const { data: roles, error: rolesErr } = await adminClient
        .from('user_roles')
        .select('user_id, role, created_at')
        .eq('role', 'admin')

      if (rolesErr) {
        return new Response(JSON.stringify({ error: rolesErr.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      // Enrich with user email
      const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const userMap = new Map((users || []).map(u => [u.id, u]))

      const admins = (roles || []).map(r => {
        const u = userMap.get(r.user_id)
        return {
          userId: r.user_id,
          email: u?.email || 'Unknown',
          createdAt: u?.created_at,
          roleAssignedAt: r.created_at,
        }
      })

      return new Response(JSON.stringify({ admins }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'POST' && action === 'add-admin') {
      const { email } = await req.json()
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      // Find user by email
      const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const targetUser = (users || []).find(u => u.email === email)
      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      // Check if already admin
      const { data: existing } = await adminClient
        .from('user_roles')
        .select('id')
        .eq('user_id', targetUser.id)
        .eq('role', 'admin')
        .maybeSingle()

      if (existing) {
        return new Response(JSON.stringify({ error: 'User is already an admin' }), { status: 409, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      const { error: insertErr } = await adminClient
        .from('user_roles')
        .insert({ user_id: targetUser.id, role: 'admin' })

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      await logAudit(adminClient, {
        adminUserId: currentAdminId,
        action: 'admin_role_grant',
        targetType: 'user_role',
        targetId: targetUser.id,
        details: { email, role: 'admin' },
      })

      return new Response(JSON.stringify({ success: true, userId: targetUser.id }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'POST' && action === 'remove-admin') {
      const { userId } = await req.json()
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      if (currentAdminId === userId) {
        return new Response(JSON.stringify({ error: 'Cannot remove your own admin role' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      const { error: deleteErr } = await adminClient
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin')

      if (deleteErr) {
        return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      await logAudit(adminClient, {
        adminUserId: currentAdminId,
        action: 'admin_role_revoke',
        targetType: 'user_role',
        targetId: userId,
        details: { role: 'admin' },
      })

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('admin-settings error:', error)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
