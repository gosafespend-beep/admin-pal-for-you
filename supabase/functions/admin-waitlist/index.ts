import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('No authorization header')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: isAdmin, error } = await userClient.rpc('is_admin')
  if (error || !isAdmin) throw new Error('Access denied')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    await verifyAdmin(req)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const page = parseInt(url.searchParams.get('page') || '1')
      const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 100)
      const search = url.searchParams.get('search') || ''
      const status = url.searchParams.get('status') || ''
      const offset = (page - 1) * pageSize

      let q = adminClient.from('waitlist').select('*', { count: 'exact' })
      if (search) q = q.ilike('email', `%${search}%`)
      if (status) q = q.eq('status', status)
      q = q.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)

      const { data, count, error } = await q
      if (error) throw error

      // Get status counts
      const { data: allEntries } = await adminClient.from('waitlist').select('status')
      const statusCounts = {
        total: count || 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      }
      allEntries?.forEach((e: { status: string }) => {
        if (e.status === 'pending') statusCounts.pending++
        else if (e.status === 'approved') statusCounts.approved++
        else if (e.status === 'rejected') statusCounts.rejected++
      })

      return new Response(
        JSON.stringify({ data, total: count || 0, page, pageSize, statusCounts }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'PATCH') {
      const body = await req.json()
      const { id, status } = body
      if (!id || !status) throw new Error('id and status required')
      if (!['pending', 'approved', 'rejected'].includes(status)) throw new Error('Invalid status')

      const { data, error } = await adminClient
        .from('waitlist')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'DELETE') {
      const body = await req.json()
      const { id } = body
      if (!id) throw new Error('id required')

      const { error } = await adminClient.from('waitlist').delete().eq('id', id)
      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = errorMessage === 'Access denied' ? 403 : errorMessage === 'No authorization header' ? 401 : 500
    console.error('Error in admin-waitlist:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
