import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useBlocker } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Save, Eye, EyeOff, Send, ChevronDown, ChevronUp,
  FileText, Image, Upload, CalendarClock, Check, X, AlertCircle, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminBlogPost, useBlogActions, useSlugCheck, BlogPost } from "@/hooks/admin/useAdminBlog";

const CATEGORIES = ["Budgeting", "Saving", "Investing", "Debt", "Tools", "News"];
const AUTOSAVE_KEY = "blog-editor-autosave";
const AUTOSAVE_INTERVAL = 30000;

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function getContentStats(content: string) {
  const text = content.trim();
  if (!text) return { words: 0, chars: 0, paragraphs: 0, readingTime: 0 };
  const words = text.split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;
  return { words, chars, paragraphs, readingTime: Math.max(1, Math.ceil(words / 200)) };
}

interface ValidationErrors {
  title?: string;
  slug?: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  featuredImage?: string;
  content?: string;
}

function validate(fields: { title: string; slug: string; excerpt: string; metaTitle: string; metaDescription: string; featuredImage: string; content: string }, requireContent: boolean): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!fields.title.trim()) errors.title = "Title is required";
  else if (fields.title.length > 200) errors.title = "Max 200 characters";
  if (!fields.slug.trim()) errors.slug = "Slug is required";
  else if (fields.slug.length > 200) errors.slug = "Max 200 characters";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug)) errors.slug = "Only lowercase letters, numbers, hyphens";
  if (fields.excerpt.length > 300) errors.excerpt = "Max 300 characters";
  if (fields.metaTitle.length > 60) errors.metaTitle = "Max 60 characters";
  if (fields.metaDescription.length > 160) errors.metaDescription = "Max 160 characters";
  if (fields.featuredImage && !/^https?:\/\/.+/.test(fields.featuredImage)) errors.featuredImage = "Must be a valid URL";
  if (requireContent && !fields.content.trim()) errors.content = "Content is required to publish";
  return errors;
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
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [isDirty, setIsDirty] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialLoadRef = useRef(false);

  // Slug availability check
  const { data: slugAvailable, isLoading: slugChecking } = useSlugCheck(slug, id);

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
      if (existingPost.scheduled_publish_at) {
        setScheduledDate(new Date(existingPost.scheduled_publish_at));
      }
      initialLoadRef.current = true;
    }
  }, [existingPost]);

  // Check for autosave recovery (new posts only)
  useEffect(() => {
    if (!isEdit && !initialLoadRef.current) {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        setShowRecoveryDialog(true);
      }
      initialLoadRef.current = true;
    }
  }, [isEdit]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual && title) setSlug(slugify(title));
  }, [title, slugManual]);

  // Auto-calculate reading time
  useEffect(() => {
    if (content) setReadingTime(estimateReadingTime(content));
  }, [content]);

  // Mark dirty on any field change (after initial load)
  useEffect(() => {
    if (initialLoadRef.current) setIsDirty(true);
  }, [title, slug, content, excerpt, category, tags, featuredImage, authorName, metaTitle, metaDescription, scheduledDate]);

  // Autosave to localStorage
  useEffect(() => {
    if (!isDirty || isEdit) return;
    const timer = setInterval(() => {
      const state = { title, slug, content, excerpt, category, tags, featuredImage, authorName, metaTitle, metaDescription, savedAt: Date.now() };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [isDirty, isEdit, title, slug, content, excerpt, category, tags, featuredImage, authorName, metaTitle, metaDescription]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // React Router navigation blocker
  const blocker = useBlocker(isDirty);

  const restoreAutosave = () => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      setTitle(state.title || "");
      setSlug(state.slug || "");
      setContent(state.content || "");
      setExcerpt(state.excerpt || "");
      setCategory(state.category || "");
      setTags(state.tags || "");
      setFeaturedImage(state.featuredImage || "");
      setAuthorName(state.authorName || "Safe Spend Team");
      setMetaTitle(state.metaTitle || "");
      setMetaDescription(state.metaDescription || "");
      if (state.slug) setSlugManual(true);
      toast.success("Draft recovered");
    }
    setShowRecoveryDialog(false);
  };

  const discardAutosave = () => {
    localStorage.removeItem(AUTOSAVE_KEY);
    setShowRecoveryDialog(false);
  };

  const buildPostData = useCallback((): Partial<BlogPost> => ({
    title, slug, content,
    excerpt: excerpt || null,
    category: category || null,
    tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    featured_image: featuredImage || null,
    author_name: authorName,
    meta_title: metaTitle || null,
    meta_description: metaDescription || null,
    reading_time_minutes: readingTime,
    scheduled_publish_at: scheduledDate ? scheduledDate.toISOString() : null,
  }), [title, slug, content, excerpt, category, tags, featuredImage, authorName, metaTitle, metaDescription, readingTime, scheduledDate]);

  const handleSaveDraft = async () => {
    const validationErrors = validate({ title, slug, excerpt, metaTitle, metaDescription, featuredImage, content }, false);
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }
    if (slug && slugAvailable === false) { toast.error("Slug is already in use"); return; }
    setErrors({});
    const data = { ...buildPostData(), is_published: false };
    try {
      if (isEdit) {
        await updatePost.mutateAsync({ ...data, id } as BlogPost & { id: string });
      } else {
        const created = await createPost.mutateAsync(data);
        localStorage.removeItem(AUTOSAVE_KEY);
        navigate(`/blog/editor/${created.id}`, { replace: true });
      }
      setIsDirty(false);
    } catch { /* errors handled by mutation */ }
  };

  const handlePublish = async () => {
    const validationErrors = validate({ title, slug, excerpt, metaTitle, metaDescription, featuredImage, content }, true);
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }
    if (slug && slugAvailable === false) { toast.error("Slug is already in use"); return; }
    setErrors({});
    const data = { ...buildPostData(), is_published: true, scheduled_publish_at: null };
    try {
      if (isEdit) {
        await updatePost.mutateAsync({ ...data, id } as BlogPost & { id: string });
      } else {
        const created = await createPost.mutateAsync(data);
        localStorage.removeItem(AUTOSAVE_KEY);
        navigate(`/blog/editor/${created.id}`, { replace: true });
      }
      setIsDirty(false);
    } catch { /* errors handled by mutation */ }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files are allowed"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max file size is 5MB"); return; }
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${slug || "untitled"}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from("blog-images").upload(filePath, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("blog-images").getPublicUrl(filePath);
      setFeaturedImage(urlData.publicUrl);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isSaving = createPost.isPending || updatePost.isPending;
  const stats = getContentStats(content);

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
      {/* Recovery dialog */}
      <AlertDialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recover unsaved draft?</AlertDialogTitle>
            <AlertDialogDescription>
              A previously unsaved draft was found. Would you like to restore it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardAutosave}>Discard</AlertDialogCancel>
            <AlertDialogAction onClick={restoreAutosave}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Navigation blocker dialog */}
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()} className="bg-destructive text-destructive-foreground">Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <div className="flex items-center gap-2 mt-1">
              {isEdit && existingPost && (
                <Badge className={`border gap-1 ${existingPost.is_published
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-warning/10 text-warning border-warning/20"
                }`}>
                  {existingPost.is_published ? "Published" : "Draft"}
                </Badge>
              )}
              {isDirty && (
                <span className="text-xs text-warning flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Unsaved changes
                </span>
              )}
            </div>
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
                  className={cn("text-lg font-semibold bg-background/50 border-border/50", errors.title && "border-destructive")}
                  maxLength={200}
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                <p className="text-xs text-muted-foreground text-right">{title.length}/200</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-muted-foreground">/blog/</span>
                  <div className="relative flex-1">
                    <Input
                      id="slug"
                      placeholder="article-slug"
                      value={slug}
                      onChange={(e) => { setSlugManual(true); setSlug(e.target.value.toLowerCase()); }}
                      className={cn("bg-background/50 border-border/50 pr-8", errors.slug && "border-destructive")}
                      maxLength={200}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {slugChecking ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
                       slug && slugAvailable === true ? <Check className="h-4 w-4 text-primary" /> :
                       slug && slugAvailable === false ? <X className="h-4 w-4 text-destructive" /> : null}
                    </div>
                  </div>
                </div>
                {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
                {slug && slugAvailable === false && <p className="text-xs text-destructive">This slug is already taken</p>}
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
            <CardContent className="p-6 pt-2 space-y-2">
              {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
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
              {/* Stats bar */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border/30 pt-2">
                <span>{stats.words} words</span>
                <span>{stats.chars} characters</span>
                <span>{stats.paragraphs} paragraphs</span>
                <span>{stats.readingTime} min read</span>
              </div>
            </CardContent>
          </Card>

          {/* Excerpt */}
          <Card className="glass-card">
            <CardContent className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="excerpt">Excerpt</Label>
                <span className={`text-xs ${excerpt.length > 300 ? "text-destructive" : excerpt.length > 250 ? "text-warning" : "text-muted-foreground"}`}>
                  {excerpt.length}/300
                </span>
              </div>
              <Textarea
                id="excerpt"
                placeholder="Brief description for previews and meta descriptions..."
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className={cn("bg-background/50 border-border/50 resize-none", errors.excerpt && "border-destructive")}
                rows={3}
                maxLength={300}
              />
              {errors.excerpt && <p className="text-xs text-destructive">{errors.excerpt}</p>}
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

              {/* Scheduled publishing */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" /> Schedule
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background/50 border-border/50", !scheduledDate && "text-muted-foreground")}>
                      <CalendarClock className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "PPP") : "No schedule"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {scheduledDate && (
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setScheduledDate(undefined)}>
                    Clear schedule
                  </Button>
                )}
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
                className={cn("bg-background/50 border-border/50", errors.featuredImage && "border-destructive")}
              />
              {errors.featuredImage && <p className="text-xs text-destructive">{errors.featuredImage}</p>}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
              <div
                className="flex items-center justify-center border-2 border-dashed border-border/50 rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files?.[0]) handleImageUpload(e.dataTransfer.files[0]); }}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload className="h-5 w-5" />
                    <span className="text-xs">Upload or drag image</span>
                  </div>
                )}
              </div>
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
                      <span className={`text-xs ${(metaTitle || title).length > 60 ? "text-destructive" : (metaTitle || title).length >= 55 ? "text-warning" : "text-muted-foreground"}`}>
                        {(metaTitle || title).length}/60
                      </span>
                    </div>
                    <Input
                      id="metaTitle"
                      placeholder={title || "Defaults to article title"}
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      className={cn("bg-background/50 border-border/50", errors.metaTitle && "border-destructive")}
                      maxLength={60}
                    />
                    {errors.metaTitle && <p className="text-xs text-destructive">{errors.metaTitle}</p>}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="metaDesc">Meta Description</Label>
                      <span className={`text-xs ${(metaDescription || excerpt).length > 160 ? "text-destructive" : (metaDescription || excerpt).length >= 140 ? "text-warning" : "text-muted-foreground"}`}>
                        {(metaDescription || excerpt).length}/160
                      </span>
                    </div>
                    <Textarea
                      id="metaDesc"
                      placeholder={excerpt || "Defaults to excerpt"}
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      className={cn("bg-background/50 border-border/50 resize-none", errors.metaDescription && "border-destructive")}
                      rows={3}
                      maxLength={160}
                    />
                    {errors.metaDescription && <p className="text-xs text-destructive">{errors.metaDescription}</p>}
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
