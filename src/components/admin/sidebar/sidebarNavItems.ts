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
  Wallet,
  TrendingUp,
  ShieldCheck,
  LifeBuoy,
  Megaphone,
  BellRing,
} from "lucide-react";

export const overviewNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
];

export const userNavItems = [
  { title: "Users", url: "/users", icon: Users },
  { title: "Support", url: "/support", icon: LifeBuoy },
  { title: "Waitlist", url: "/waitlist", icon: ClipboardList },
  { title: "Data requests", url: "/data-requests", icon: ShieldCheck },
];

export const financeNavItems = [
  { title: "Transactions", url: "/transactions", icon: Receipt },
  { title: "Billing", url: "/billing", icon: Wallet },
  { title: "Subscriptions", url: "/subscriptions", icon: CreditCard },
];

export const contentNavItems = [
  { title: "Blog", url: "/blog", icon: FileText },
];

export const insightsNavItems = [
  { title: "Growth", url: "/growth", icon: TrendingUp },
  { title: "Marketing", url: "/marketing", icon: Megaphone },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Ebook", url: "/ebook", icon: BookOpen },
  { title: "Audit Log", url: "/audit-log", icon: Shield },
];

export const systemNavItems = [
  { title: "Alerts", url: "/alerts", icon: BellRing },
  { title: "Settings", url: "/settings", icon: Settings },
];
