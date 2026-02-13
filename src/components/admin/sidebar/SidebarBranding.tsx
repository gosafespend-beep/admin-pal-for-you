import { Sparkles } from "lucide-react";
import { SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import logo from "@/assets/logo-optimized.webp";

export function SidebarBranding() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarHeader className="p-4">
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
          <img src={logo} alt="Go Safe Spend" className="h-7 w-7 object-contain" width={28} height={28} loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight truncate">
              Go Safe Spend
            </span>
            <span className="flex items-center gap-1 text-xs text-primary">
              <Sparkles className="h-3 w-3" />
              Admin Panel
            </span>
          </div>
        )}
      </div>
    </SidebarHeader>
  );
}
