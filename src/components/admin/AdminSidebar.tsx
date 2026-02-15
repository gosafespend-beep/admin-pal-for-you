import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SidebarBranding } from "./sidebar/SidebarBranding";
import { SidebarNavGroup } from "./sidebar/SidebarNavGroup";
import { overviewNavItems, userNavItems, financeNavItems, contentNavItems, insightsNavItems, systemNavItems } from "./sidebar/sidebarNavItems";

interface AdminSidebarProps {
  onSignOut: () => void;
}

export function AdminSidebar({ onSignOut }: AdminSidebarProps) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar-background"
    >
      <SidebarBranding />

      <Separator className="mx-4 w-auto bg-sidebar-border/50" />

      <SidebarContent className="px-2 py-4">
        <SidebarNavGroup label="Overview" items={overviewNavItems} />
        <SidebarNavGroup label="User Management" items={userNavItems} className="mt-2" />
        <SidebarNavGroup label="Finance" items={financeNavItems} className="mt-2" />
        <SidebarNavGroup label="Content" items={contentNavItems} className="mt-2" />
        <SidebarNavGroup label="Insights" items={insightsNavItems} className="mt-2" />
        <SidebarNavGroup label="System" items={systemNavItems} className="mt-2" />
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Separator className="mb-4 bg-sidebar-border/50" />
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 h-10 rounded-xl",
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            "transition-all duration-200"
          )}
          onClick={onSignOut}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <LogOut className="h-4 w-4 text-destructive" />
          </div>
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="mt-2 w-full h-8 justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
          onClick={toggleSidebar}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
