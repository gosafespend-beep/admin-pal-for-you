import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')
    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const url = new URL(req.url)

    if (req.method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1')
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20')
      const statusFilter = url.searchParams.get('status') || ''
      const search = url.searchParams.get('search') || ''

      // Fetch all subscriptions
      let query = adminClient.from('subscriptions').select('*').order('created_at', { ascending: false })

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data: subscriptions, error: subErr } = await query

      if (subErr) {
        return new Response(JSON.stringify({ error: subErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Get user emails
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

      // Stats
      const stats = {
        total: (subscriptions || []).length,
        active: (subscriptions || []).filter(s => s.status === 'active').length,
        trialing: (subscriptions || []).filter(s => s.status === 'trialing').length,
        cancelled: (subscriptions || []).filter(s => s.status === 'cancelled').length,
        expired: (subscriptions || []).filter(s => s.status === 'expired').length,
      }

      return new Response(JSON.stringify({ subscriptions: paginated, total, stats }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('admin-subscriptions error:', error)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
