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
  BookOpen,
} from "lucide-react";

export const overviewNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
];

export const userNavItems = [
  { title: "Users", url: "/users", icon: Users },
  { title: "Waitlist", url: "/waitlist", icon: ClipboardList },
];

export const financeNavItems = [
  { title: "Transactions", url: "/transactions", icon: Receipt },
  { title: "Subscriptions", url: "/subscriptions", icon: CreditCard },
];

export const contentNavItems = [
  { title: "Blog", url: "/blog", icon: FileText },
];

export const insightsNavItems = [
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Ebook", url: "/ebook", icon: BookOpen },
  { title: "Audit Log", url: "/audit-log", icon: Shield },
];

export const systemNavItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];
