import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useParams, useBlocker } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Save, Eye, EyeOff, Send, ChevronDown, ChevronUp,
  FileText, Image, Upload, CalendarClock, Check, X, AlertCircle, Loader2,
  Target, Megaphone, Link2, Star, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
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
import { useAdminBlogPost, useAdminBlogList, useBlogActions, useSlugCheck, BlogPost } from "@/hooks/admin/useAdminBlog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  if (!text) return { words: 0, chars: 0, paragraphs: 0, readingTime: 0, h2Count: 0, h3Count: 0 };
  const words = text.split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;
  const h2Count = (text.match(/^##\s/gm) || []).length;
  const h3Count = (text.match(/^###\s/gm) || []).length;
  return { words, chars, paragraphs, readingTime: Math.max(1, Math.ceil(words / 200)), h2Count, h3Count };
}

function getSeoScore(fields: {
  title: string; metaTitle: string; metaDescription: string; excerpt: string;
  slug: string; focusKeyword: string; content: string; words: number;
  h2Count: number; h3Count: number;
}) {
  const checks: { label: string; status: "green" | "yellow" | "red" }[] = [];
  const effectiveTitle = fields.metaTitle || fields.title;
  const effectiveDesc = fields.metaDescription || fields.excerpt;

  // Word count
  if (fields.words >= 1000) checks.push({ label: "Word count (1000+)", status: "green" });
  else if (fields.words >= 500) checks.push({ label: "Word count (500+)", status: "yellow" });
  else checks.push({ label: "Word count (< 500)", status: "red" });

  // Title length
  if (effectiveTitle.length > 0 && effectiveTitle.length <= 60) checks.push({ label: "Title length", status: "green" });
  else if (effectiveTitle.length > 60) checks.push({ label: "Title too long", status: "red" });
  else checks.push({ label: "No title", status: "red" });

  // Meta description
  if (effectiveDesc.length >= 120 && effectiveDesc.length <= 160) checks.push({ label: "Meta description", status: "green" });
  else if (effectiveDesc.length > 0) checks.push({ label: "Meta description length", status: "yellow" });
  else checks.push({ label: "No meta description", status: "red" });

  // Headings
  if (fields.h2Count >= 2) checks.push({ label: "H2 headings", status: "green" });
  else if (fields.h2Count === 1) checks.push({ label: "H2 headings (add more)", status: "yellow" });
  else checks.push({ label: "No H2 headings", status: "red" });

  // Focus keyword
  if (fields.focusKeyword) {
    const kw = fields.focusKeyword.toLowerCase();
    const inTitle = effectiveTitle.toLowerCase().includes(kw);
    const inContent = fields.content.toLowerCase().includes(kw);
    const inSlug = fields.slug.includes(kw.replace(/\s+/g, '-'));
    if (inTitle && inContent) checks.push({ label: "Keyword in title & content", status: "green" });
    else if (inTitle || inContent) checks.push({ label: "Keyword partially used", status: "yellow" });
    else checks.push({ label: "Keyword not found", status: "red" });

    // Keyword density
    if (fields.words > 0) {
      const kwRegex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const occurrences = (fields.content.match(kwRegex) || []).length;
      const density = (occurrences / fields.words) * 100;
      if (density >= 0.5 && density <= 2.5) checks.push({ label: `Keyword density (${density.toFixed(1)}%)`, status: "green" });
      else if (density > 0) checks.push({ label: `Keyword density (${density.toFixed(1)}%)`, status: "yellow" });
      else checks.push({ label: "Keyword not in content", status: "red" });
    }

    if (inSlug) checks.push({ label: "Keyword in slug", status: "green" });
    else checks.push({ label: "Keyword not in slug", status: "yellow" });
  } else {
    checks.push({ label: "No focus keyword set", status: "red" });
  }

  // Slug quality
  if (fields.slug && fields.slug.length <= 60 && !fields.slug.includes('--')) checks.push({ label: "Slug quality", status: "green" });
  else if (fields.slug) checks.push({ label: "Slug could be shorter", status: "yellow" });
  else checks.push({ label: "No slug", status: "red" });

  const greenCount = checks.filter(c => c.status === "green").length;
  const total = checks.length;
  const score = Math.round((greenCount / total) * 100);

  return { checks, score };
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

  // Core fields
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

  // New SEO fields
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [faqSchemaEnabled, setFaqSchemaEnabled] = useState(false);
  const [articleSchemaEnabled, setArticleSchemaEnabled] = useState(true);

  // CTA fields
  const [ctaHeadline, setCtaHeadline] = useState("");
  const [ctaDescription, setCtaDescription] = useState("");
  const [ctaButtonText, setCtaButtonText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("https://app.gosafespend.com");
  const [ctaOpen, setCtaOpen] = useState(false);
  const [seoScoreOpen, setSeoScoreOpen] = useState(false);

  // Link insertion state
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [customLinkText, setCustomLinkText] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPosRef = useRef<number>(0);

  const { data: slugAvailable, isLoading: slugChecking } = useSlugCheck(slug, id);

  // Fetch blog posts for internal link search
  const { data: linkSearchResults } = useAdminBlogList({
    search: linkSearch,
    status: "published",
    category: "",
    page: 1,
    pageSize: 8,
  });

  // Populate from existing post
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
      if (existingPost.scheduled_publish_at) setScheduledDate(new Date(existingPost.scheduled_publish_at));
      // New fields
      setCanonicalUrl(existingPost.canonical_url || "");
      setFocusKeyword(existingPost.focus_keyword || "");
      setSecondaryKeywords((existingPost.secondary_keywords || []).join(", "));
      setOgImage(existingPost.og_image || "");
      setIsFeatured(existingPost.is_featured || false);
      setFaqSchemaEnabled(existingPost.faq_schema_enabled || false);
      setArticleSchemaEnabled(existingPost.article_schema_enabled !== false);
      setCtaHeadline(existingPost.cta_headline || "");
      setCtaDescription(existingPost.cta_description || "");
      setCtaButtonText(existingPost.cta_button_text || "");
      setCtaUrl(existingPost.cta_url || "https://app.gosafespend.com");
      initialLoadRef.current = true;
    }
  }, [existingPost]);

  // Autosave recovery
  useEffect(() => {
    if (!isEdit && !initialLoadRef.current) {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) setShowRecoveryDialog(true);
      initialLoadRef.current = true;
    }
  }, [isEdit]);

  useEffect(() => { if (!slugManual && title) setSlug(slugify(title)); }, [title, slugManual]);
  useEffect(() => { if (content) setReadingTime(estimateReadingTime(content)); }, [content]);

  useEffect(() => {
    if (initialLoadRef.current) setIsDirty(true);
  }, [title, slug, content, excerpt, category, tags, featuredImage, authorName, metaTitle, metaDescription, scheduledDate, canonicalUrl, focusKeyword, secondaryKeywords, ogImage, isFeatured, faqSchemaEnabled, articleSchemaEnabled, ctaHeadline, ctaDescription, ctaButtonText, ctaUrl]);

  // Autosave
  useEffect(() => {
    if (!isDirty || isEdit) return;
    const timer = setInterval(() => {
      const state = { title, slug, content, excerpt, category, tags, featuredImage, authorName, metaTitle, metaDescription, focusKeyword, secondaryKeywords, canonicalUrl, ctaHeadline, ctaDescription, ctaButtonText, ctaUrl, savedAt: Date.now() };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [isDirty, isEdit, title, slug, content, excerpt, category, tags, featuredImage, authorName, metaTitle, metaDescription, focusKeyword, secondaryKeywords, canonicalUrl, ctaHeadline, ctaDescription, ctaButtonText, ctaUrl]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const blocker = useBlocker(isDirty);

  const restoreAutosave = () => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      const s = JSON.parse(saved);
      setTitle(s.title || ""); setSlug(s.slug || ""); setContent(s.content || "");
      setExcerpt(s.excerpt || ""); setCategory(s.category || ""); setTags(s.tags || "");
      setFeaturedImage(s.featuredImage || ""); setAuthorName(s.authorName || "Safe Spend Team");
      setMetaTitle(s.metaTitle || ""); setMetaDescription(s.metaDescription || "");
      setFocusKeyword(s.focusKeyword || ""); setSecondaryKeywords(s.secondaryKeywords || "");
      setCanonicalUrl(s.canonicalUrl || "");
      setCtaHeadline(s.ctaHeadline || ""); setCtaDescription(s.ctaDescription || "");
      setCtaButtonText(s.ctaButtonText || ""); setCtaUrl(s.ctaUrl || "https://app.gosafespend.com");
      if (s.slug) setSlugManual(true);
      toast.success("Draft recovered");
    }
    setShowRecoveryDialog(false);
  };

  const discardAutosave = () => { localStorage.removeItem(AUTOSAVE_KEY); setShowRecoveryDialog(false); };

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
    canonical_url: canonicalUrl || null,
    focus_keyword: focusKeyword || null,
    secondary_keywords: secondaryKeywords.split(",").map(k => k.trim()).filter(Boolean),
    og_image: ogImage || null,
    is_featured: isFeatured,
    faq_schema_enabled: faqSchemaEnabled,
    article_schema_enabled: articleSchemaEnabled,
    cta_headline: ctaHeadline || null,
    cta_description: ctaDescription || null,
    cta_button_text: ctaButtonText || null,
    cta_url: ctaUrl || null,
  }), [title, slug, content, excerpt, category, tags, featuredImage, authorName, metaTitle, metaDescription, readingTime, scheduledDate, canonicalUrl, focusKeyword, secondaryKeywords, ogImage, isFeatured, faqSchemaEnabled, articleSchemaEnabled, ctaHeadline, ctaDescription, ctaButtonText, ctaUrl]);

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

  const insertMarkdownLink = useCallback((linkText: string, url: string) => {
    const link = `[${linkText}](${url})`;
    const pos = cursorPosRef.current;
    const newContent = content.substring(0, pos) + link + content.substring(pos);
    setContent(newContent);
    setLinkPopoverOpen(false);
    setLinkSearch("");
    setCustomLinkText("");
    setCustomLinkUrl("");
    // Restore focus after insert
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const newPos = pos + link.length;
        ta.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [content]);

  const handleLinkPopoverOpen = (open: boolean) => {
    if (open) {
      cursorPosRef.current = textareaRef.current?.selectionStart ?? content.length;
    }
    setLinkPopoverOpen(open);
  };

  const isSaving = createPost.isPending || updatePost.isPending;
  const stats = getContentStats(content);
  const seoScore = useMemo(() => getSeoScore({
    title, metaTitle, metaDescription, excerpt, slug, focusKeyword, content,
    words: stats.words, h2Count: stats.h2Count, h3Count: stats.h3Count,
  }), [title, metaTitle, metaDescription, excerpt, slug, focusKeyword, content, stats.words, stats.h2Count, stats.h3Count]);

  const scoreColor = seoScore.score >= 70 ? "text-primary" : seoScore.score >= 40 ? "text-warning" : "text-destructive";
  const scoreBgColor = seoScore.score >= 70 ? "bg-primary/10 border-primary/20" : seoScore.score >= 40 ? "bg-warning/10 border-warning/20" : "bg-destructive/10 border-destructive/20";

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
            <AlertDialogDescription>A previously unsaved draft was found. Would you like to restore it?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardAutosave}>Discard</AlertDialogCancel>
            <AlertDialogAction onClick={restoreAutosave}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Navigation blocker */}
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. Are you sure you want to leave?</AlertDialogDescription>
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
                <Badge className={`border gap-1 ${existingPost.is_published ? "bg-primary/10 text-primary border-primary/20" : "bg-warning/10 text-warning border-warning/20"}`}>
                  {existingPost.is_published ? "Published" : "Draft"}
                </Badge>
              )}
              {isFeatured && <Badge className="border bg-accent/10 text-accent-foreground border-accent/20 gap-1"><Star className="h-3 w-3" /> Featured</Badge>}
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
          {/* Title + Slug */}
          <Card className="glass-card">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="Enter article title..." value={title} onChange={(e) => setTitle(e.target.value)}
                  className={cn("text-lg font-semibold bg-background/50 border-border/50", errors.title && "border-destructive")} maxLength={200} />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                <p className="text-xs text-muted-foreground text-right">{title.length}/200</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-muted-foreground">/blog/</span>
                  <div className="relative flex-1">
                    <Input id="slug" placeholder="article-slug" value={slug}
                      onChange={(e) => { setSlugManual(true); setSlug(e.target.value.toLowerCase()); }}
                      className={cn("bg-background/50 border-border/50 pr-8", errors.slug && "border-destructive")} maxLength={200} />
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "*No content yet...*"}</ReactMarkdown>
                </div>
              ) : (
                <>
                  {/* Markdown Toolbar */}
                  <div className="flex items-center gap-1 border border-border/30 rounded-md p-1 bg-background/30">
                    <Popover open={linkPopoverOpen} onOpenChange={handleLinkPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs">
                          <Link2 className="h-3.5 w-3.5" /> Insert Link
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <Tabs defaultValue="internal" className="w-full">
                          <TabsList className="w-full rounded-b-none">
                            <TabsTrigger value="internal" className="flex-1">Blog Posts</TabsTrigger>
                            <TabsTrigger value="custom" className="flex-1">Custom URL</TabsTrigger>
                          </TabsList>
                          <TabsContent value="internal" className="p-3 space-y-2 mt-0">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Search articles..."
                                value={linkSearch}
                                onChange={(e) => setLinkSearch(e.target.value)}
                                className="pl-8 h-8 text-sm bg-background/50"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                              {linkSearchResults?.data?.length ? (
                                linkSearchResults.data
                                  .filter((p) => p.id !== id)
                                  .map((post) => (
                                    <button
                                      key={post.id}
                                      className="w-full text-left px-2 py-1.5 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground transition-colors truncate"
                                      onClick={() => insertMarkdownLink(post.title, `/blog/${post.slug}`)}
                                    >
                                      {post.title}
                                    </button>
                                  ))
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-3">
                                  {linkSearch ? "No articles found" : "Type to search articles"}
                                </p>
                              )}
                            </div>
                          </TabsContent>
                          <TabsContent value="custom" className="p-3 space-y-3 mt-0">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Link Text</Label>
                              <Input
                                placeholder="Click here"
                                value={customLinkText}
                                onChange={(e) => setCustomLinkText(e.target.value)}
                                className="h-8 text-sm bg-background/50"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">URL</Label>
                              <Input
                                placeholder="https://..."
                                value={customLinkUrl}
                                onChange={(e) => setCustomLinkUrl(e.target.value)}
                                className="h-8 text-sm bg-background/50"
                              />
                            </div>
                            <Button
                              size="sm"
                              className="w-full h-8 text-xs"
                              disabled={!customLinkText || !customLinkUrl}
                              onClick={() => insertMarkdownLink(customLinkText, customLinkUrl)}
                            >
                              Insert Link
                            </Button>
                          </TabsContent>
                        </Tabs>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Textarea
                    ref={textareaRef}
                    placeholder="Write your article in Markdown..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[400px] font-mono text-sm bg-background/50 border-border/50 resize-y"
                  />
                </>
              )}
              {/* Stats bar with SEO indicators */}
              <div className="flex flex-wrap gap-4 text-xs border-t border-border/30 pt-2">
                <span className={stats.words >= 1000 ? "text-primary" : stats.words >= 500 ? "text-warning" : "text-destructive"}>
                  {stats.words} words
                </span>
                <span className="text-muted-foreground">{stats.chars} chars</span>
                <span className="text-muted-foreground">{stats.paragraphs} paragraphs</span>
                <span className={stats.h2Count >= 2 ? "text-primary" : stats.h2Count >= 1 ? "text-warning" : "text-destructive"}>
                  {stats.h2Count} H2s
                </span>
                <span className="text-muted-foreground">{stats.h3Count} H3s</span>
                <span className="text-muted-foreground">{stats.readingTime} min read</span>
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
              <Textarea id="excerpt" placeholder="Brief description for previews and meta descriptions (150-160 chars ideal)..."
                value={excerpt} onChange={(e) => setExcerpt(e.target.value)}
                className={cn("bg-background/50 border-border/50 resize-none", errors.excerpt && "border-destructive")}
                rows={3} maxLength={300} />
              {errors.excerpt && <p className="text-xs text-destructive">{errors.excerpt}</p>}
            </CardContent>
          </Card>

          {/* CTA Block */}
          <Collapsible open={ctaOpen} onOpenChange={setCtaOpen}>
            <Card className="glass-card">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-card/80 transition-colors">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> CTA Block</span>
                    {ctaHeadline && <Badge variant="outline" className="text-xs border-primary/20 text-primary">Active</Badge>}
                    {ctaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <Separator className="bg-border/30" />
                  <p className="text-xs text-muted-foreground">Add a call-to-action block that appears at the end of the article to drive conversions.</p>
                  <div className="space-y-2">
                    <Label htmlFor="ctaHeadline">CTA Headline</Label>
                    <Input id="ctaHeadline" placeholder="Start managing your money smarter" value={ctaHeadline}
                      onChange={(e) => setCtaHeadline(e.target.value)} className="bg-background/50 border-border/50" maxLength={200} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ctaDesc">CTA Description</Label>
                    <Textarea id="ctaDesc" placeholder="Join thousands of users who track spending and build better habits..."
                      value={ctaDescription} onChange={(e) => setCtaDescription(e.target.value)}
                      className="bg-background/50 border-border/50 resize-none" rows={2} maxLength={500} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="ctaBtnText">Button Text</Label>
                      <Input id="ctaBtnText" placeholder="Get Started Free" value={ctaButtonText}
                        onChange={(e) => setCtaButtonText(e.target.value)} className="bg-background/50 border-border/50" maxLength={50} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ctaUrlField">Button URL</Label>
                      <Input id="ctaUrlField" placeholder="https://app.gosafespend.com" value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)} className="bg-background/50 border-border/50" />
                    </div>
                  </div>
                  {ctaHeadline && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
                      <h4 className="text-base font-semibold text-foreground">{ctaHeadline}</h4>
                      {ctaDescription && <p className="text-sm text-muted-foreground">{ctaDescription}</p>}
                      <Button size="sm" className="mt-2">{ctaButtonText || "Learn More"}</Button>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* SEO Score */}
          <Collapsible open={seoScoreOpen} onOpenChange={setSeoScoreOpen}>
            <Card className={cn("glass-card border-l-4", seoScore.score >= 70 ? "border-l-primary" : seoScore.score >= 40 ? "border-l-warning" : "border-l-destructive")}>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-card/80 transition-colors">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2"><Search className="h-4 w-4" /> SEO Score</span>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("border", scoreBgColor, scoreColor)}>{seoScore.score}%</Badge>
                      {seoScoreOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-1">
                  <Separator className="bg-border/30 mb-2" />
                  {seoScore.checks.map((check, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                      <div className={cn("h-2 w-2 rounded-full shrink-0",
                        check.status === "green" ? "bg-primary" : check.status === "yellow" ? "bg-warning" : "bg-destructive"
                      )} />
                      <span className="text-muted-foreground">{check.label}</span>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Focus Keywords */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Keywords</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="focusKw">Primary Keyword</Label>
                <Input id="focusKw" placeholder="e.g. budgeting tips" value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)} className="bg-background/50 border-border/50" maxLength={100} />
                <p className="text-xs text-muted-foreground">The main keyword this article targets</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secKw">Secondary Keywords</Label>
                <Input id="secKw" placeholder="money saving, expense tracking" value={secondaryKeywords}
                  onChange={(e) => setSecondaryKeywords(e.target.value)} className="bg-background/50 border-border/50" />
                <p className="text-xs text-muted-foreground">Comma-separated</p>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-background/50 border-border/50"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input id="tags" placeholder="budgeting, finance, tips" value={tags} onChange={(e) => setTags(e.target.value)}
                  className="bg-background/50 border-border/50" />
                <p className="text-xs text-muted-foreground">Comma-separated</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input id="author" value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="bg-background/50 border-border/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="readTime">Reading Time (min)</Label>
                <Input id="readTime" type="number" min={1} value={readingTime} onChange={(e) => setReadingTime(parseInt(e.target.value) || 1)}
                  className="bg-background/50 border-border/50" />
              </div>

              {/* Featured toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="featured" className="flex items-center gap-2 cursor-pointer">
                  <Star className="h-4 w-4" /> Featured Article
                </Label>
                <Switch id="featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>

              {/* Scheduled publishing */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Schedule</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background/50 border-border/50", !scheduledDate && "text-muted-foreground")}>
                      <CalendarClock className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "PPP") : "No schedule"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                {scheduledDate && (
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setScheduledDate(undefined)}>Clear schedule</Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Featured Image */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Image className="h-4 w-4" /> Featured Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="https://example.com/image.jpg" value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)}
                className={cn("bg-background/50 border-border/50", errors.featuredImage && "border-destructive")} />
              {errors.featuredImage && <p className="text-xs text-destructive">{errors.featuredImage}</p>}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
              <div className="flex items-center justify-center border-2 border-dashed border-border/50 rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files?.[0]) handleImageUpload(e.dataTransfer.files[0]); }}>
                {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload className="h-5 w-5" /><span className="text-xs">Upload or drag image</span>
                  </div>
                )}
              </div>
              {featuredImage && (
                <div className="rounded-lg overflow-hidden border border-border/30">
                  <img src={featuredImage} alt="Featured" className="w-full h-32 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* SEO Overrides */}
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
                    <Input id="metaTitle" placeholder={title || "Defaults to article title"} value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      className={cn("bg-background/50 border-border/50", errors.metaTitle && "border-destructive")} maxLength={60} />
                    {errors.metaTitle && <p className="text-xs text-destructive">{errors.metaTitle}</p>}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="metaDesc">Meta Description</Label>
                      <span className={`text-xs ${(metaDescription || excerpt).length > 160 ? "text-destructive" : (metaDescription || excerpt).length >= 140 ? "text-warning" : "text-muted-foreground"}`}>
                        {(metaDescription || excerpt).length}/160
                      </span>
                    </div>
                    <Textarea id="metaDesc" placeholder={excerpt || "Defaults to excerpt"} value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      className={cn("bg-background/50 border-border/50 resize-none", errors.metaDescription && "border-destructive")}
                      rows={3} maxLength={160} />
                    {errors.metaDescription && <p className="text-xs text-destructive">{errors.metaDescription}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="canonical" className="flex items-center gap-2"><Link2 className="h-3 w-3" /> Canonical URL</Label>
                    <Input id="canonical" placeholder="https://gosafespend.com/blog/original-article" value={canonicalUrl}
                      onChange={(e) => setCanonicalUrl(e.target.value)} className="bg-background/50 border-border/50" />
                    <p className="text-xs text-muted-foreground">Only set if republishing from another source</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ogImg">Social Preview Image (OG)</Label>
                    <Input id="ogImg" placeholder="https://... (defaults to featured image)" value={ogImage}
                      onChange={(e) => setOgImage(e.target.value)} className="bg-background/50 border-border/50" />
                  </div>

                  <Separator className="bg-border/30" />
                  <p className="text-xs text-muted-foreground font-medium">Structured Data</p>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="articleSchema" className="text-sm cursor-pointer">Enable Article Schema</Label>
                    <Switch id="articleSchema" checked={articleSchemaEnabled} onCheckedChange={setArticleSchemaEnabled} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="faqSchema" className="text-sm cursor-pointer">Enable FAQ Schema</Label>
                    <Switch id="faqSchema" checked={faqSchemaEnabled} onCheckedChange={setFaqSchemaEnabled} />
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
