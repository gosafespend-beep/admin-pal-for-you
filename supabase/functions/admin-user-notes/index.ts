import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function getAdminUserId(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('No authorization header')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })
  
  const { data: isAdmin, error } = await userClient.rpc('is_admin')
  if (error || !isAdmin) throw new Error('Access denied')

  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw new Error('Could not get user')
  return user.id
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const adminUserId = await getAdminUserId(req)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const userId = url.searchParams.get('userId')
      if (!userId) throw new Error('userId required')

      const { data, error } = await adminClient
        .from('admin_user_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Enrich with admin emails
      const adminIds = [...new Set((data || []).map((n: { admin_id: string }) => n.admin_id))]
      const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const userMap = new Map((users || []).map(u => [u.id, u.email]))

      const enriched = (data || []).map((note: Record<string, unknown>) => ({
        ...note,
        adminEmail: userMap.get(note.admin_id as string) || 'Unknown',
      }))

      return new Response(JSON.stringify({ data: enriched }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'POST') {
      const { userId, note, tag } = await req.json()
      if (!userId || !note) throw new Error('userId and note are required')

      const { data, error } = await adminClient
        .from('admin_user_notes')
        .insert({ user_id: userId, admin_id: adminUserId, note, tag: tag || null })
        .select()
        .single()

      if (error) throw error

      // Also log to audit
      await adminClient.from('admin_audit_log').insert({
        admin_user_id: adminUserId,
        action: 'add_note',
        target_type: 'user',
        target_id: userId,
        details: { note, tag },
      })

      return new Response(JSON.stringify({ data }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'DELETE') {
      const { noteId } = await req.json()
      if (!noteId) throw new Error('noteId required')

      const { error } = await adminClient.from('admin_user_notes').delete().eq('id', noteId)
      if (error) throw error

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    const status = msg === 'Access denied' ? 403 : msg === 'No authorization header' ? 401 : 500
    console.error('admin-user-notes error:', error)
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
