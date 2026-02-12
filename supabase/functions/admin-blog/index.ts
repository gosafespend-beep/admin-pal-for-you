import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
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
      const id = url.searchParams.get('id')

      // Single post fetch
      if (id) {
        const { data, error } = await adminClient
          .from('blog_posts')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw error
        return new Response(
          JSON.stringify({ data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // List with pagination
      const page = parseInt(url.searchParams.get('page') || '1')
      const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 100)
      const search = url.searchParams.get('search') || ''
      const status = url.searchParams.get('status') || ''
      const category = url.searchParams.get('category') || ''
      const offset = (page - 1) * pageSize

      let q = adminClient.from('blog_posts').select('*', { count: 'exact' })
      if (search) q = q.ilike('title', `%${search}%`)
      if (status === 'published') q = q.eq('is_published', true)
      else if (status === 'draft') q = q.eq('is_published', false)
      if (category) q = q.eq('category', category)
      q = q.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)

      const { data, count, error } = await q
      if (error) throw error

      // Get status counts
      const { data: allPosts } = await adminClient.from('blog_posts').select('is_published, category')
      const statusCounts = {
        total: count || 0,
        published: 0,
        draft: 0,
      }
      const categories = new Set<string>()
      allPosts?.forEach((p: { is_published: boolean; category: string | null }) => {
        if (p.is_published) statusCounts.published++
        else statusCounts.draft++
        if (p.category) categories.add(p.category)
      })

      return new Response(
        JSON.stringify({ data, total: count || 0, page, pageSize, statusCounts, categories: Array.from(categories) }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const { title, content } = body
      if (!title) throw new Error('Title is required')

      const slug = body.slug || slugify(title)
      const reading_time_minutes = body.reading_time_minutes || (content ? estimateReadingTime(content) : 1)
      const is_published = body.is_published || false

      const insertData: Record<string, unknown> = {
        title,
        slug,
        content: content || '',
        excerpt: body.excerpt || null,
        featured_image: body.featured_image || null,
        author_name: body.author_name || 'Safe Spend Team',
        category: body.category || null,
        tags: body.tags || [],
        is_published,
        meta_title: body.meta_title || null,
        meta_description: body.meta_description || null,
        reading_time_minutes,
      }
      if (is_published) {
        insertData.published_at = new Date().toISOString()
      }

      const { data, error } = await adminClient
        .from('blog_posts')
        .insert(insertData)
        .select()
        .single()
      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'PUT') {
      const body = await req.json()
      const { id, ...updates } = body
      if (!id) throw new Error('id is required')

      // Auto-calculate reading time if content changed
      if (updates.content && !updates.reading_time_minutes) {
        updates.reading_time_minutes = estimateReadingTime(updates.content)
      }

      // Set published_at when publishing for the first time
      if (updates.is_published === true) {
        const { data: existing } = await adminClient
          .from('blog_posts')
          .select('published_at, is_published')
          .eq('id', id)
          .single()
        if (existing && !existing.published_at) {
          updates.published_at = new Date().toISOString()
        }
      }

      updates.updated_at = new Date().toISOString()

      const { data, error } = await adminClient
        .from('blog_posts')
        .update(updates)
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
      if (!id) throw new Error('id is required')

      const { error } = await adminClient.from('blog_posts').delete().eq('id', id)
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
    console.error('Error in admin-blog:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
