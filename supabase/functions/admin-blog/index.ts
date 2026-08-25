import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFor, forbidden } from "../_shared/guard.ts";
import { getAdminUserId, logAudit } from "../_shared/audit.ts";

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

function sanitizeContent(content: string): string {
  return content.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<script[\s\S]*?\/>/gi, '')
}

function validatePost(body: Record<string, unknown>, isUpdate = false): string | null {
  const title = body.title as string | undefined
  const slug = body.slug as string | undefined
  const excerpt = body.excerpt as string | undefined
  const meta_title = body.meta_title as string | undefined
  const meta_description = body.meta_description as string | undefined
  const canonical_url = body.canonical_url as string | undefined
  const focus_keyword = body.focus_keyword as string | undefined
  const cta_headline = body.cta_headline as string | undefined
  const cta_description = body.cta_description as string | undefined
  const cta_button_text = body.cta_button_text as string | undefined
  const cta_url = body.cta_url as string | undefined

  if (!isUpdate && !title) return 'Title is required'
  if (title && title.length > 200) return 'Title must be 200 characters or less'
  if (slug) {
    if (slug.length > 200) return 'Slug must be 200 characters or less'
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return 'Slug must contain only lowercase letters, numbers, and hyphens'
  }
  if (excerpt && excerpt.length > 300) return 'Excerpt must be 300 characters or less'
  if (meta_title && meta_title.length > 60) return 'Meta title must be 60 characters or less'
  if (meta_description && meta_description.length > 160) return 'Meta description must be 160 characters or less'
  if (canonical_url && !/^https?:\/\/.+/.test(canonical_url)) return 'Canonical URL must be a valid URL'
  if (focus_keyword && focus_keyword.length > 100) return 'Focus keyword must be 100 characters or less'
  if (cta_headline && cta_headline.length > 200) return 'CTA headline must be 200 characters or less'
  if (cta_description && cta_description.length > 500) return 'CTA description must be 500 characters or less'
  if (cta_button_text && cta_button_text.length > 50) return 'CTA button text must be 50 characters or less'
  if (cta_url && !/^https?:\/\/.+/.test(cta_url)) return 'CTA URL must be a valid URL'
  return null
}

async function checkSlugUnique(adminClient: ReturnType<typeof createClient>, slug: string, excludeId?: string): Promise<boolean> {
  let q = adminClient.from('blog_posts').select('id').eq('slug', slug)
  if (excludeId) q = q.neq('id', excludeId)
  const { data } = await q.limit(1)
  return !data || data.length === 0
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

function getAdminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

async function handleGet(req: Request, cors: Record<string, string>) {
  const adminClient = getAdminClient()
  const url = new URL(req.url)

  // Slug availability check
  const checkSlug = url.searchParams.get('checkSlug')
  if (checkSlug) {
    const excludeId = url.searchParams.get('excludeId') || undefined
    const available = await checkSlugUnique(adminClient, checkSlug, excludeId)
    return new Response(JSON.stringify({ available }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // Single post fetch
  const id = url.searchParams.get('id')
  if (id) {
    const { data, error } = await adminClient.from('blog_posts').select('*').eq('id', id).single()
    if (error) throw error
    return new Response(JSON.stringify({ data }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // List with pagination & sorting
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 100)
  const search = url.searchParams.get('search') || ''
  const status = url.searchParams.get('status') || ''
  const category = url.searchParams.get('category') || ''
  const sortBy = url.searchParams.get('sortBy') || 'created_at'
  const sortOrder = url.searchParams.get('sortOrder') || 'desc'
  const offset = (page - 1) * pageSize

  const allowedSortColumns = ['title', 'created_at', 'published_at', 'reading_time_minutes', 'updated_at']
  const safeSort = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at'
  const ascending = sortOrder === 'asc'

  let q = adminClient.from('blog_posts').select('*', { count: 'exact' })
  if (search) q = q.ilike('title', `%${search}%`)
  if (status === 'published') q = q.eq('is_published', true)
  else if (status === 'draft') q = q.eq('is_published', false)
  if (category) q = q.eq('category', category)
  q = q.order(safeSort, { ascending }).range(offset, offset + pageSize - 1)

  const { data, count, error } = await q
  if (error) throw error

  const { data: allPosts } = await adminClient.from('blog_posts').select('is_published, category')
  const statusCounts = { total: count || 0, published: 0, draft: 0 }
  const categories = new Set<string>()
  allPosts?.forEach((p: { is_published: boolean; category: string | null }) => {
    if (p.is_published) statusCounts.published++
    else statusCounts.draft++
    if (p.category) categories.add(p.category)
  })

  return new Response(
    JSON.stringify({ data, total: count || 0, page, pageSize, statusCounts, categories: Array.from(categories) }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
  )
}

async function handlePost(req: Request, cors: Record<string, string>) {
  const adminClient = getAdminClient()
  const body = await req.json()

  const validationError = validatePost(body)
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  const { title, content } = body
  const slug = body.slug || slugify(title)

  // Check slug uniqueness
  if (!await checkSlugUnique(adminClient, slug)) {
    return new Response(JSON.stringify({ error: `Slug "${slug}" is already in use` }), {
      status: 409, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  const sanitizedContent = content ? sanitizeContent(content) : ''
  const reading_time_minutes = body.reading_time_minutes || (sanitizedContent ? estimateReadingTime(sanitizedContent) : 1)
  const is_published = body.is_published || false

  const insertData: Record<string, unknown> = {
    title,
    slug,
    content: sanitizedContent,
    excerpt: body.excerpt || null,
    featured_image: body.featured_image || null,
    author_name: body.author_name || 'Safe Spend Team',
    category: body.category || null,
    tags: body.tags || [],
    is_published,
    meta_title: body.meta_title || null,
    meta_description: body.meta_description || null,
    reading_time_minutes,
    scheduled_publish_at: body.scheduled_publish_at || null,
    canonical_url: body.canonical_url || null,
    focus_keyword: body.focus_keyword || null,
    secondary_keywords: body.secondary_keywords || [],
    og_image: body.og_image || null,
    is_featured: body.is_featured || false,
    faq_schema_enabled: body.faq_schema_enabled || false,
    article_schema_enabled: body.article_schema_enabled !== false,
    cta_headline: body.cta_headline || null,
    cta_description: body.cta_description || null,
    cta_button_text: body.cta_button_text || null,
    cta_url: body.cta_url || 'https://app.gosafespend.com',
  }
  if (is_published) insertData.published_at = new Date().toISOString()

  const { data, error } = await adminClient.from('blog_posts').insert(insertData).select().single()
  if (error) throw error

  await logAudit(adminClient, {
    adminUserId: await getAdminUserId(req),
    action: is_published ? 'blog_post_create_published' : 'blog_post_create_draft',
    targetType: 'blog_post',
    targetId: data.id,
    details: { title, slug },
  })

  return new Response(JSON.stringify({ data }), {
    status: 201, headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

async function handlePut(req: Request, cors: Record<string, string>) {
  const adminClient = getAdminClient()
  const body = await req.json()

  // Bulk update
  if (body.ids && Array.isArray(body.ids)) {
    const { ids, updates } = body
    if (!ids.length || !updates) throw new Error('ids and updates are required for bulk operations')
    const results = []
    for (const postId of ids) {
      const updateData = { ...updates, updated_at: new Date().toISOString() }
      if (updates.is_published === true) {
        const { data: existing } = await adminClient.from('blog_posts').select('published_at').eq('id', postId).single()
        if (existing && !existing.published_at) updateData.published_at = new Date().toISOString()
      }
      const { data, error } = await adminClient.from('blog_posts').update(updateData).eq('id', postId).select().single()
      if (error) throw error
      results.push(data)
    }
    await logAudit(adminClient, {
      adminUserId: await getAdminUserId(req),
      action: 'blog_post_bulk_update',
      targetType: 'blog_post',
      targetId: ids.join(','),
      details: { count: ids.length, updates },
    })

    return new Response(JSON.stringify({ data: results }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // Single update
  const { id, ...updates } = body
  if (!id) throw new Error('id is required')

  const validationError = validatePost(updates, true)
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // Check slug uniqueness if slug changed
  if (updates.slug) {
    if (!await checkSlugUnique(adminClient, updates.slug, id)) {
      return new Response(JSON.stringify({ error: `Slug "${updates.slug}" is already in use` }), {
        status: 409, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
  }

  if (updates.content) {
    updates.content = sanitizeContent(updates.content)
    if (!updates.reading_time_minutes) {
      updates.reading_time_minutes = estimateReadingTime(updates.content)
    }
  }

  if (updates.is_published === true) {
    const { data: existing } = await adminClient.from('blog_posts').select('published_at, is_published').eq('id', id).single()
    if (existing && !existing.published_at) updates.published_at = new Date().toISOString()
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await adminClient.from('blog_posts').update(updates).eq('id', id).select().single()
  if (error) throw error

  await logAudit(adminClient, {
    adminUserId: await getAdminUserId(req),
    action: updates.is_published === true ? 'blog_post_publish' : updates.is_published === false ? 'blog_post_unpublish' : 'blog_post_update',
    targetType: 'blog_post',
    targetId: id,
    details: { fields: Object.keys(updates), title: data?.title, slug: data?.slug },
  })

  return new Response(JSON.stringify({ data }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

async function handleDelete(req: Request, cors: Record<string, string>) {
  const adminClient = getAdminClient()
  const body = await req.json()

  // Bulk delete
  if (body.ids && Array.isArray(body.ids)) {
    const { error } = await adminClient.from('blog_posts').delete().in('id', body.ids)
    if (error) throw error
    await logAudit(adminClient, {
      adminUserId: await getAdminUserId(req),
      action: 'blog_post_bulk_delete',
      targetType: 'blog_post',
      targetId: body.ids.join(','),
      details: { count: body.ids.length },
    })
    return new Response(JSON.stringify({ success: true, deleted: body.ids.length }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // Single delete
  const { id } = body
  if (!id) throw new Error('id is required')
  const { data: existingPost } = await adminClient.from('blog_posts').select('title, slug').eq('id', id).maybeSingle()
  const { error } = await adminClient.from('blog_posts').delete().eq('id', id)
  if (error) throw error

  await logAudit(adminClient, {
    adminUserId: await getAdminUserId(req),
    action: 'blog_post_delete',
    targetType: 'blog_post',
    targetId: id,
    details: { title: existingPost?.title, slug: existingPost?.slug },
  })

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    await verifyAdmin(req)

    switch (req.method) {
      case 'GET': return await handleGet(req, cors)
      case 'POST': return await handlePost(req, cors)
      case 'PUT': return await handlePut(req, cors)
      case 'DELETE': return await handleDelete(req, cors)
      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
        })
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = errorMessage === 'Access denied' ? 403 : errorMessage === 'No authorization header' ? 401 : 500
    console.error('Error in admin-blog:', error)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
