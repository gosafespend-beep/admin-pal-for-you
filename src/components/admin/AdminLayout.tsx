import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { AdminSearch } from "./AdminSearch";
import { PageErrorBoundary } from "./PageErrorBoundary";
import { useAdminAuth } from "@/hooks/admin/useAdminAuth";
import { documentTitle, pageName } from "@/lib/shell";
import { Loader2 } from "lucide-react";

export function AdminLayout() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const content = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate("/login");
    }
  }, [user, isAdmin, isLoading, navigate]);

  // Each page gets its own tab title, and after a page change focus moves to the
  // content so keyboard and screen-reader users start at the top of the new page
  // instead of wherever the old link was. Not on the first load, which would steal focus.
  useEffect(() => {
    document.title = documentTitle(pathname);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    content.current?.focus({ preventScroll: true });
  }, [pathname]);

  if (isLoading) {
    return (
      <div role="status" className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar onSignOut={signOut} />
        {/* SidebarInset is already the page's <main> landmark, so the content area inside it is a plain region. */}
        <SidebarInset className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 md:px-6 backdrop-blur-xl">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
            <div className="hidden md:block">
              <AdminBreadcrumbs />
            </div>
            <div className="flex-1" />
            <AdminSearch />
            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
                <span className="text-xs font-medium text-primary">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </header>
          <div id="main-content" ref={content} tabIndex={-1} className="flex-1 overflow-auto p-4 outline-none sm:p-6">
            <PageErrorBoundary resetKey={pathname}>
              <Outlet />
            </PageErrorBoundary>
          </div>
          <div role="status" aria-live="polite" className="sr-only">{`${pageName(pathname)} page`}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
