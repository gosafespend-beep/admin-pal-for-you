import { useEffect, useRef, useState } from "react";
import {
  Settings as SettingsIcon,
  Shield,
  Database,
  Server,
  HardDrive,
  Zap,
  Globe,
  ExternalLink,
  Lock,
  UserPlus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Image,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSystemHealth, useAdminList, useAddAdmin, useRemoveAdmin, useBlogImageSettings, useUpdateBlogImageSettings } from "@/hooks/admin/useAdminSettings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BlogImage } from "@/components/admin/BlogImage";

function HealthStatusIcon({ status }: { status: string }) {
  if (status === "healthy") return <CheckCircle className="h-4 w-4 text-primary" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-destructive" />;
  return <AlertTriangle className="h-4 w-4 text-warning" />;
}

const serviceConfig = [
  { key: "database", label: "Database", icon: Database, gradient: "gradient-primary" },
  { key: "authentication", label: "Authentication", icon: Shield, gradient: "gradient-info" },
  { key: "storage", label: "Storage", icon: HardDrive, gradient: "gradient-purple" },
  { key: "edgeFunctions", label: "Edge Functions", icon: Zap, gradient: "gradient-warning" },
];

const supabaseLinks = [
  { icon: Database, label: "Table Editor", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/editor", color: "primary" },
  { icon: Shield, label: "Auth Users", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/auth/users", color: "info" },
  { icon: HardDrive, label: "Storage", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/storage/buckets", color: "purple" },
  { icon: Zap, label: "Edge Functions", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/functions", color: "warning" },
  { icon: Database, label: "SQL Editor", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/sql/new", color: "pink" },
  { icon: SettingsIcon, label: "Project Settings", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/settings/general", color: "orange" },
];

export default function Settings() {
  const { toast } = useToast();
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useSystemHealth();
  const { data: adminData, isLoading: adminsLoading } = useAdminList();
  const addAdmin = useAddAdmin();
  const removeAdmin = useRemoveAdmin();
  const { data: blogImageSettings, isLoading: blogImageLoading } = useBlogImageSettings();
  const updateBlogImageSettings = useUpdateBlogImageSettings();
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [defaultBlogImage, setDefaultBlogImage] = useState("");
  const [uploadingBlogImage, setUploadingBlogImage] = useState(false);
  const blogImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (blogImageSettings) setDefaultBlogImage(blogImageSettings.defaultFeaturedImage);
  }, [blogImageSettings]);

  const handleBlogImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "The maximum size is 5 MB.", variant: "destructive" });
      return;
    }

    setUploadingBlogImage(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `defaults/blog-default-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from("blog-images").upload(filePath, file);
      if (error) throw error;
      const { data } = supabase.storage.from("blog-images").getPublicUrl(filePath);
      setDefaultBlogImage(data.publicUrl);
    } catch (error: unknown) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Could not upload image", variant: "destructive" });
    } finally {
      setUploadingBlogImage(false);
    }
  };

  const handleSaveBlogImage = async () => {
    if (!/^https:\/\/.+/.test(defaultBlogImage)) {
      toast({ title: "Invalid image link", description: "Enter a valid HTTPS image link.", variant: "destructive" });
      return;
    }
    try {
      await updateBlogImageSettings.mutateAsync(defaultBlogImage);
      toast({ title: "Default image saved", description: "Blog posts now use this image when their own image is unavailable." });
    } catch (error: unknown) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Could not save image", variant: "destructive" });
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    try {
      await addAdmin.mutateAsync(newAdminEmail.trim());
      toast({ title: "Admin added", description: `${newAdminEmail} is now an admin.` });
      setNewAdminEmail("");
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to add admin", variant: "destructive" });
    }
  };

  const handleRemoveAdmin = async (userId: string, email: string) => {
    try {
      await removeAdmin.mutateAsync(userId);
      toast({ title: "Admin removed", description: `${email} is no longer an admin.` });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to remove admin", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground">System health, admin management, and quick links</p>
      </div>

      {/* System Health */}
      <Card className="glass-card overflow-hidden">
        <div className="h-1 w-full gradient-primary" />
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              System Health
            </CardTitle>
            <CardDescription>Live status of platform services</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchHealth()} disabled={healthLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${healthLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {serviceConfig.map((svc) => {
              const check = health?.checks[svc.key];
              const isHealthy = check?.status === "healthy";
              return (
                <div
                  key={svc.key}
                  className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
                    healthLoading
                      ? "border-border/50 bg-muted/20"
                      : isHealthy
                      ? "border-primary/20 bg-primary/5 hover:border-primary/40"
                      : "border-destructive/20 bg-destructive/5 hover:border-destructive/40"
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${svc.gradient}`}>
                    <svc.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{svc.label}</p>
                    {healthLoading ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs">
                        <HealthStatusIcon status={check?.status || "unknown"} />
                        <span className={isHealthy ? "text-primary" : "text-destructive"}>
                          {isHealthy ? "Healthy" : check?.status || "Unknown"}
                        </span>
                        {check?.latency !== undefined && (
                          <span className="text-muted-foreground ml-1">({check.latency}ms)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {health?.timestamp && (
            <p className="text-xs text-muted-foreground mt-3">
              Last checked: {new Date(health.timestamp).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Admin Role Management */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-warning" />
            Admin Role Management
          </CardTitle>
          <CardDescription>Manage users with admin access to this panel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add admin */}
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="admin-email" className="sr-only">Email</Label>
              <Input
                id="admin-email"
                placeholder="Enter user email to grant admin access..."
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddAdmin()}
                className="bg-card/50"
              />
            </div>
            <Button onClick={handleAddAdmin} disabled={addAdmin.isPending || !newAdminEmail.trim()}>
              {addAdmin.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Add Admin
            </Button>
          </div>

          <Separator />

          {/* Admin list */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">Current Admins</Label>
            {adminsLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-14 shimmer rounded-xl" />)}
              </div>
            ) : (
              (adminData?.admins || []).map((admin) => (
                <div
                  key={admin.userId}
                  className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">
                        {admin.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{admin.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Admin since {new Date(admin.roleAssignedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Admin Access</AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove admin privileges from <strong>{admin.email}</strong>? They will no longer be able to access this panel.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleRemoveAdmin(admin.userId, admin.email)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))
            )}
            {!adminsLoading && (adminData?.admins || []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No admins found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blog defaults */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Blog Default Image
          </CardTitle>
          <CardDescription>Used when an article has no featured image or its image cannot load</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="default-blog-image">Image link</Label>
                <Input
                  id="default-blog-image"
                  type="url"
                  placeholder="https://..."
                  value={defaultBlogImage}
                  onChange={(event) => setDefaultBlogImage(event.target.value)}
                  disabled={blogImageLoading}
                  className="bg-card/50"
                />
              </div>
              <input
                ref={blogImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleBlogImageUpload(file);
                  event.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => blogImageInputRef.current?.click()} disabled={uploadingBlogImage}>
                  {uploadingBlogImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Choose image
                </Button>
                <Button
                  onClick={handleSaveBlogImage}
                  disabled={blogImageLoading || updateBlogImageSettings.isPending || !defaultBlogImage || defaultBlogImage === blogImageSettings?.defaultFeaturedImage}
                >
                  {updateBlogImageSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save default
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/50">
              <BlogImage
                src={defaultBlogImage}
                alt="Default blog image preview"
                className="h-36 w-full object-cover"
                placeholderClassName="h-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Overview */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-info" />
            Security
          </CardTitle>
          <CardDescription>Security configuration overview</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Row Level Security", desc: "Database-level security policies", color: "primary" },
            { label: "Admin Role Verification", desc: "Server-side role validation via Edge Functions", color: "info" },
            { label: "Edge Function Security", desc: "Admin-only API endpoints with service role", color: "purple" },
          ].map((item) => (
            <div key={item.label} className={`flex items-center justify-between p-4 rounded-xl bg-${item.color}/5 border border-${item.color}/20`}>
              <div>
                <Label className="text-foreground font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Badge className={`bg-${item.color}/10 text-${item.color} border border-${item.color}/20`}>
                <CheckCircle className="mr-1 h-3 w-3" />
                Enabled
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-info" />
            Supabase Dashboard
          </CardTitle>
          <CardDescription>Quick access to Supabase management tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {supabaseLinks.map((item) => (
              <Button
                key={item.label}
                variant="outline"
                className="h-auto flex-col gap-3 p-5 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all group relative"
                asChild
              >
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  <item.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium">{item.label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/50 absolute top-3 right-3" />
                </a>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
