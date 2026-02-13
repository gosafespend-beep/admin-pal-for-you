import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface SidebarNavGroupProps {
  label: string;
  items: NavItem[];
  className?: string;
}

export function SidebarNavGroup({ label, items, className }: SidebarNavGroupProps) {
  const location = useLocation();

  const isActive = (path: string) =>
    path === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(path);

  return (
    <SidebarGroup className={className}>
      <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
                className={cn(
                  "h-10 gap-3 rounded-xl transition-all duration-200 group/item",
                  isActive(item.url)
                    ? "bg-gradient-to-r from-primary/15 to-primary/5 text-primary border border-primary/20 shadow-sm"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <NavLink
                  to={item.url}
                  end={item.url === "/dashboard"}
                  className="flex items-center gap-3"
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200",
                      isActive(item.url)
                        ? "bg-primary/20"
                        : "bg-muted/50 group-hover/item:bg-muted"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isActive(item.url) ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <span className="text-sm font-medium">{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
