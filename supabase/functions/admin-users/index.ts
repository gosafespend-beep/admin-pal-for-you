import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFor, forbidden } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')
    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 100)
    const search = url.searchParams.get('search') || ''
    const roleFilter = url.searchParams.get('role') || ''
    const verifiedFilter = url.searchParams.get('verified') || ''
    const sortBy = url.searchParams.get('sortBy') || 'created_at'
    const sortOrder = url.searchParams.get('sortOrder') || 'desc'

    // Fetch auth users (Supabase admin API doesn't support pagination well, so we fetch all and paginate in memory)
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) throw usersError

    // Fetch enrichment data in parallel
    const [profilesResult, settingsResult, rolesResult] = await Promise.all([
      adminClient.from('profiles').select('user_id, display_name, avatar_url'),
      adminClient.from('user_settings').select('user_id, currency, theme, date_format'),
      adminClient.from('user_roles').select('user_id, role'),
    ])

    const profilesMap = new Map((profilesResult.data || []).map(p => [p.user_id, p]))
    const settingsMap = new Map((settingsResult.data || []).map(s => [s.user_id, s]))
    const rolesMap = new Map<string, string[]>()
    for (const r of (rolesResult.data || [])) {
      const existing = rolesMap.get(r.user_id) || []
      existing.push(r.role)
      rolesMap.set(r.user_id, existing)
    }

    // Enrich users
    let enrichedUsers = users.map(user => {
      const profile = profilesMap.get(user.id)
      const settings = settingsMap.get(user.id)
      const userRoles = rolesMap.get(user.id) || []
      return {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_sign_in_at: user.last_sign_in_at,
        banned_until: user.banned_until,
        display_name: profile?.display_name || null,
        avatar_url: profile?.avatar_url || null,
        currency: settings?.currency || 'USD',
        theme: settings?.theme || 'dark',
        date_format: settings?.date_format || 'MM/dd/yyyy',
        roles: userRoles,
        is_admin: userRoles.includes('admin'),
      }
    })

    // Apply filters
    if (search) {
      const s = search.toLowerCase()
      enrichedUsers = enrichedUsers.filter(u =>
        u.email?.toLowerCase().includes(s) ||
        u.display_name?.toLowerCase().includes(s)
      )
    }
    if (roleFilter === 'admin') {
      enrichedUsers = enrichedUsers.filter(u => u.is_admin)
    } else if (roleFilter === 'user') {
      enrichedUsers = enrichedUsers.filter(u => !u.is_admin)
    }
    if (verifiedFilter === 'verified') {
      enrichedUsers = enrichedUsers.filter(u => u.email_confirmed_at)
    } else if (verifiedFilter === 'unverified') {
      enrichedUsers = enrichedUsers.filter(u => !u.email_confirmed_at)
    }

    // Sort
    enrichedUsers.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortBy] as string || ''
      const bVal = (b as Record<string, unknown>)[sortBy] as string || ''
      const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      return sortOrder === 'desc' ? -cmp : cmp
    })

    const total = enrichedUsers.length
    const totalAdmins = enrichedUsers.filter(u => u.is_admin).length
    const totalVerified = enrichedUsers.filter(u => u.email_confirmed_at).length
    const totalSuspended = enrichedUsers.filter(u => u.banned_until && new Date(u.banned_until) > new Date()).length

    // Paginate
    const offset = (page - 1) * pageSize
    const paginatedUsers = enrichedUsers.slice(offset, offset + pageSize)

    return new Response(
      JSON.stringify({
        users: paginatedUsers,
        total,
        page,
        pageSize,
        stats: { totalAdmins, totalVerified, totalSuspended },
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in admin-users:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
