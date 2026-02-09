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
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'all'
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 100)
    const search = url.searchParams.get('search') || ''
    const startDate = url.searchParams.get('startDate') || ''
    const endDate = url.searchParams.get('endDate') || ''
    const userId = url.searchParams.get('userId') || ''
    const offset = (page - 1) * pageSize

    const results: Record<string, unknown> = {}

    // Fetch expenses
    if (type === 'all' || type === 'expenses') {
      let q = adminClient.from('expenses').select('id, amount, category, date, note, reference_number, user_id, created_at', { count: 'exact' })
      if (search) q = q.or(`category.ilike.%${search}%,note.ilike.%${search}%,reference_number.ilike.%${search}%`)
      if (startDate) q = q.gte('date', startDate)
      if (endDate) q = q.lte('date', endDate)
      if (userId) q = q.eq('user_id', userId)
      q = q.order('date', { ascending: false }).range(offset, offset + pageSize - 1)
      const { data, count, error } = await q
      results.expenses = { data: data || [], total: count || 0, error: error?.message }
    }

    // Fetch incomes
    if (type === 'all' || type === 'incomes') {
      let q = adminClient.from('incomes').select('id, amount, source, category, date, note, reference_number, user_id, created_at', { count: 'exact' })
      if (search) q = q.or(`source.ilike.%${search}%,note.ilike.%${search}%,reference_number.ilike.%${search}%`)
      if (startDate) q = q.gte('date', startDate)
      if (endDate) q = q.lte('date', endDate)
      if (userId) q = q.eq('user_id', userId)
      q = q.order('date', { ascending: false }).range(offset, offset + pageSize - 1)
      const { data, count, error } = await q
      results.incomes = { data: data || [], total: count || 0, error: error?.message }
    }

    // Fetch transfers
    if (type === 'all' || type === 'transfers') {
      let q = adminClient.from('transfers').select('id, amount, date, note, reference_number, user_id, created_at', { count: 'exact' })
      if (search) q = q.or(`note.ilike.%${search}%,reference_number.ilike.%${search}%`)
      if (startDate) q = q.gte('date', startDate)
      if (endDate) q = q.lte('date', endDate)
      if (userId) q = q.eq('user_id', userId)
      q = q.order('date', { ascending: false }).range(offset, offset + pageSize - 1)
      const { data, count, error } = await q
      results.transfers = { data: data || [], total: count || 0, error: error?.message }
    }

    return new Response(
      JSON.stringify({ page, pageSize, ...results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in admin-transactions:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
