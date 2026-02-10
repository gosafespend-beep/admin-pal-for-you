import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { action, userId, data } = await req.json()
    
    if (!action || !userId) {
      return new Response(
        JSON.stringify({ error: 'action and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify admin access
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

    // Get admin user id for audit logging
    const { data: { user: adminUser } } = await userClient.auth.getUser()
    const adminUserId = adminUser?.id

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    let result: { success: boolean; message: string }

    switch (action) {
      case 'suspend': {
        // Ban user for specified duration (default 30 days)
        const banDuration = data?.duration || 30
        const banUntil = new Date()
        banUntil.setDate(banUntil.getDate() + banDuration)
        
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: `${banDuration}d`
        })
        
        if (error) throw error
        result = { success: true, message: `User suspended for ${banDuration} days` }
        console.log(`[admin-user-actions] Suspended user ${userId} for ${banDuration} days`)
        break
      }

      case 'unsuspend': {
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: 'none'
        })
        
        if (error) throw error
        result = { success: true, message: 'User suspension lifted' }
        console.log(`[admin-user-actions] Unsuspended user ${userId}`)
        break
      }

      case 'delete': {
        const { error } = await adminClient.auth.admin.deleteUser(userId)
        
        if (error) throw error
        result = { success: true, message: 'User deleted permanently' }
        console.log(`[admin-user-actions] Deleted user ${userId}`)
        break
      }

      case 'promote': {
        // Add admin role
        const { error } = await adminClient.from('user_roles').insert({
          user_id: userId,
          role: 'admin'
        })
        
        if (error && !error.message.includes('duplicate')) throw error
        result = { success: true, message: 'User promoted to admin' }
        console.log(`[admin-user-actions] Promoted user ${userId} to admin`)
        break
      }

      case 'demote': {
        // Remove admin role
        const { error } = await adminClient.from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin')
        
        if (error) throw error
        result = { success: true, message: 'Admin privileges removed' }
        console.log(`[admin-user-actions] Demoted user ${userId} from admin`)
        break
      }

      case 'resend_confirmation': {
        const { data: user } = await adminClient.auth.admin.getUserById(userId)
        if (user?.user?.email) {
          const { error } = await adminClient.auth.resend({
            type: 'signup',
            email: user.user.email
          })
          if (error) throw error
        }
        result = { success: true, message: 'Confirmation email sent' }
        console.log(`[admin-user-actions] Resent confirmation to user ${userId}`)
        break
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Audit log
    if (adminUserId) {
      await adminClient.from('admin_audit_log').insert({
        admin_user_id: adminUserId,
        action,
        target_type: 'user',
        target_id: userId,
        details: { result: result.message, ...(data || {}) },
      })
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error in admin-user-actions function:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
