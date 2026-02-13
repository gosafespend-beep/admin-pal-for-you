import {
  LayoutDashboard,
  Users,
  Receipt,
  ClipboardList,
  CreditCard,
  Settings,
  BarChart3,
  Shield,
  FileText,
} from "lucide-react";

export const mainNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Users", url: "/users", icon: Users },
  { title: "Transactions", url: "/transactions", icon: Receipt },
  { title: "Subscriptions", url: "/subscriptions", icon: CreditCard },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Waitlist", url: "/waitlist", icon: ClipboardList },
  { title: "Audit Log", url: "/audit-log", icon: Shield },
  { title: "Blog", url: "/blog", icon: FileText },
];

export const systemNavItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];
