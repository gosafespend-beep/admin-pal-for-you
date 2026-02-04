import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a Supabase client with the user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // First, verify the user is an admin using their token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')
    
    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin privileges required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Now use service role to fetch all users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch auth users
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers()
    
    if (usersError) {
      throw usersError
    }

    // Fetch profiles to enrich user data
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('*')

    if (profilesError) {
      throw profilesError
    }

    // Fetch user settings
    const { data: settings, error: settingsError } = await adminClient
      .from('user_settings')
      .select('*')

    if (settingsError) {
      throw settingsError
    }

    // Fetch user roles
    const { data: roles, error: rolesError } = await adminClient
      .from('user_roles')
      .select('*')

    if (rolesError) {
      throw rolesError
    }

    // Combine the data
    const enrichedUsers = users.map(user => {
      const profile = profiles?.find(p => p.user_id === user.id)
      const userSettings = settings?.find(s => s.user_id === user.id)
      const userRoles = roles?.filter(r => r.user_id === user.id).map(r => r.role) || []

      return {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_sign_in_at: user.last_sign_in_at,
        // Profile data
        display_name: profile?.display_name,
        avatar_url: profile?.avatar_url,
        // Settings data
        currency: userSettings?.currency || 'USD',
        theme: userSettings?.theme || 'dark',
        date_format: userSettings?.date_format || 'MM/dd/yyyy',
        // Roles
        roles: userRoles,
        is_admin: userRoles.includes('admin'),
      }
    })

    return new Response(
      JSON.stringify({ users: enrichedUsers }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error in admin-users function:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
