import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Send,
  ChevronDown,
  ChevronUp,
  FileText,
  Image,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useAdminBlogPost, useBlogActions, BlogPost } from "@/hooks/admin/useAdminBlog";

const CATEGORIES = ["Budgeting", "Saving", "Investing", "Debt", "Tools", "News"];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export default function BlogEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: existingPost, isLoading: loadingPost } = useAdminBlogPost(id);
  const { createPost, updatePost } = useBlogActions();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [authorName, setAuthorName] = useState("Safe Spend Team");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [readingTime, setReadingTime] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  // Populate form from existing post
  useEffect(() => {
    if (existingPost) {
      setTitle(existingPost.title);
      setSlug(existingPost.slug);
      setContent(existingPost.content || "");
      setExcerpt(existingPost.excerpt || "");
      setCategory(existingPost.category || "");
      setTags((existingPost.tags || []).join(", "));
      setFeaturedImage(existingPost.featured_image || "");
      setAuthorName(existingPost.author_name);
      setMetaTitle(existingPost.meta_title || "");
      setMetaDescription(existingPost.meta_description || "");
      setReadingTime(existingPost.reading_time_minutes);
      setSlugManual(true);
    }
  }, [existingPost]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual && title) {
      setSlug(slugify(title));
    }
  }, [title, slugManual]);

  // Auto-calculate reading time
  useEffect(() => {
    if (content) {
      setReadingTime(estimateReadingTime(content));
    }
  }, [content]);

  const buildPostData = useCallback((): Partial<BlogPost> => ({
    title,
    slug,
    content,
    excerpt: excerpt || null,
    category: category || null,
    tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    featured_image: featuredImage || null,
    author_name: authorName,
    meta_title: metaTitle || null,
    meta_description: metaDescription || null,
    reading_time_minutes: readingTime,
  }), [title, slug, content, excerpt, category, tags, featuredImage, authorName, metaTitle, metaDescription, readingTime]);

  const handleSaveDraft = async () => {
    const data = { ...buildPostData(), is_published: false };
    if (isEdit) {
      await updatePost.mutateAsync({ ...data, id } as BlogPost & { id: string });
    } else {
      const created = await createPost.mutateAsync(data);
      navigate(`/blog/editor/${created.id}`, { replace: true });
    }
  };

  const handlePublish = async () => {
    const data = { ...buildPostData(), is_published: true };
    if (isEdit) {
      await updatePost.mutateAsync({ ...data, id } as BlogPost & { id: string });
    } else {
      const created = await createPost.mutateAsync(data);
      navigate(`/blog/editor/${created.id}`, { replace: true });
    }
  };

  const isSaving = createPost.isPending || updatePost.isPending;

  if (isEdit && loadingPost) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 shimmer rounded" />
        <div className="h-[600px] shimmer rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/blog")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isEdit ? "Edit Article" : "New Article"}
            </h1>
            {isEdit && existingPost && (
              <Badge className={`mt-1 border gap-1 ${existingPost.is_published
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-warning/10 text-warning border-warning/20"
              }`}>
                {existingPost.is_published ? "Published" : "Draft"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? "Edit" : "Preview"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSaveDraft} disabled={!title || isSaving}>
            <Save className="h-4 w-4" /> Save Draft
          </Button>
          <Button size="sm" className="gap-2" onClick={handlePublish} disabled={!title || !content || isSaving}>
            <Send className="h-4 w-4" /> Publish
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-card">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter article title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg font-semibold bg-background/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-muted-foreground">/blog/</span>
                  <Input
                    id="slug"
                    placeholder="article-slug"
                    value={slug}
                    onChange={(e) => { setSlugManual(true); setSlug(e.target.value); }}
                    className="bg-background/50 border-border/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Editor / Preview */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Content {showPreview ? "(Preview)" : "(Markdown)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {showPreview ? (
                <div className="prose prose-invert max-w-none min-h-[400px] rounded-lg border border-border/30 p-6 bg-background/30">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content || "*No content yet...*"}
                  </ReactMarkdown>
                </div>
              ) : (
                <Textarea
                  placeholder="Write your article in Markdown..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm bg-background/50 border-border/50 resize-y"
                />
              )}
            </CardContent>
          </Card>

          {/* Excerpt */}
          <Card className="glass-card">
            <CardContent className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="excerpt">Excerpt</Label>
                <span className={`text-xs ${excerpt.length > 160 ? "text-destructive" : excerpt.length >= 140 ? "text-primary" : "text-muted-foreground"}`}>
                  {excerpt.length}/160
                </span>
              </div>
              <Textarea
                id="excerpt"
                placeholder="Brief description for previews and meta descriptions (150-160 chars ideal)..."
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="bg-background/50 border-border/50 resize-none"
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-background/50 border-border/50">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  placeholder="budgeting, finance, tips"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="bg-background/50 border-border/50"
                />
                <p className="text-xs text-muted-foreground">Comma-separated</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="bg-background/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="readTime">Reading Time (min)</Label>
                <Input
                  id="readTime"
                  type="number"
                  min={1}
                  value={readingTime}
                  onChange={(e) => setReadingTime(parseInt(e.target.value) || 1)}
                  className="bg-background/50 border-border/50"
                />
              </div>
            </CardContent>
          </Card>

          {/* Featured Image */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="h-4 w-4" /> Featured Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="https://example.com/image.jpg"
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
                className="bg-background/50 border-border/50"
              />
              {featuredImage && (
                <div className="rounded-lg overflow-hidden border border-border/30">
                  <img src={featuredImage} alt="Featured" className="w-full h-32 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* SEO Section */}
          <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
            <Card className="glass-card">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-card/80 transition-colors">
                  <CardTitle className="text-base flex items-center justify-between">
                    SEO Overrides
                    {seoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <Separator className="bg-border/30" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="metaTitle">Meta Title</Label>
                      <span className={`text-xs ${(metaTitle || title).length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                        {(metaTitle || title).length}/60
                      </span>
                    </div>
                    <Input
                      id="metaTitle"
                      placeholder={title || "Defaults to article title"}
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      className="bg-background/50 border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="metaDesc">Meta Description</Label>
                      <span className={`text-xs ${(metaDescription || excerpt).length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                        {(metaDescription || excerpt).length}/160
                      </span>
                    </div>
                    <Textarea
                      id="metaDesc"
                      placeholder={excerpt || "Defaults to excerpt"}
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      className="bg-background/50 border-border/50 resize-none"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
