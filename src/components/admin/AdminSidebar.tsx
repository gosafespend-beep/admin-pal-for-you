import { 
  LayoutDashboard, 
  Users, 
  Receipt, 
  ClipboardList,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BarChart3,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, color: "text-primary" },
  { title: "Users", url: "/admin/users", icon: Users, color: "text-info" },
  { title: "Transactions", url: "/admin/transactions", icon: Receipt, color: "text-purple" },
  { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard, color: "text-orange" },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3, color: "text-pink" },
  { title: "Waitlist", url: "/admin/waitlist", icon: ClipboardList, color: "text-warning" },
  { title: "Audit Log", url: "/admin/audit-log", icon: Shield, color: "text-muted-foreground" },
];

const settingsNavItems = [
  { title: "Settings", url: "/admin/settings", icon: Settings, color: "text-muted-foreground" },
];

interface AdminSidebarProps {
  onSignOut: () => void;
}

export function AdminSidebar({ onSignOut }: AdminSidebarProps) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-sidebar-border bg-sidebar-background"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <img src={logo} alt="Go Safe Spend" className="h-8 w-8 object-contain" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground tracking-tight">
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

      <Separator className="mx-4 w-auto bg-sidebar-border/50" />

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={cn(
                      "h-11 gap-3 rounded-xl transition-all duration-200 group/item",
                      isActive(item.url) 
                        ? "bg-gradient-to-r from-primary/15 to-primary/5 text-primary border border-primary/20 shadow-sm" 
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="flex items-center gap-3"
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                        isActive(item.url) 
                          ? "bg-primary/20" 
                          : "bg-muted/50 group-hover/item:bg-muted"
                      )}>
                        <item.icon className={cn(
                          "h-4 w-4 transition-colors",
                          isActive(item.url) ? "text-primary" : item.color
                        )} />
                      </div>
                      <span className="font-medium">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={cn(
                      "h-11 gap-3 rounded-xl transition-all duration-200 group/item",
                      isActive(item.url) 
                        ? "bg-gradient-to-r from-primary/15 to-primary/5 text-primary border border-primary/20 shadow-sm" 
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3"
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                        isActive(item.url) 
                          ? "bg-primary/20" 
                          : "bg-muted/50 group-hover/item:bg-muted"
                      )}>
                        <item.icon className={cn(
                          "h-4 w-4",
                          isActive(item.url) && "text-primary"
                        )} />
                      </div>
                      <span className="font-medium">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Separator className="mb-4 bg-sidebar-border/50" />
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 h-11 rounded-xl",
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            "transition-all duration-200"
          )}
          onClick={onSignOut}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
            <LogOut className="h-4 w-4 text-destructive" />
          </div>
          {!collapsed && <span className="font-medium">Sign Out</span>}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="mt-2 w-full h-9 justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
          onClick={toggleSidebar}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}