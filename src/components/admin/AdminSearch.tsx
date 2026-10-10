import { useEffect, useState, useCallback } from "react";
import { useSupportLookup } from "@/hooks/admin/useAdminSupport";
import { useNavigate } from "react-router-dom";
import { Search, LayoutDashboard, Users, Receipt, CreditCard, ClipboardList, Settings, FileText, BarChart3, ScrollText, BookOpen, LifeBuoy, Megaphone, BellRing, Activity, Mail, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const pages = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, keywords: "home overview stats" },
  { name: "Users", path: "/users", icon: Users, keywords: "members accounts people" },
  { name: "Transactions", path: "/transactions", icon: Receipt, keywords: "expenses income payments" },
  { name: "Billing", path: "/billing", icon: CreditCard, keywords: "mrr arr revenue trials churn paystack" },
  { name: "Subscriptions", path: "/subscriptions", icon: CreditCard, keywords: "plans billing" },
  { name: "Waitlist", path: "/waitlist", icon: ClipboardList, keywords: "signups emails" },
  { name: "Settings", path: "/settings", icon: Settings, keywords: "config health admins" },
  { name: "Support", path: "/support", icon: LifeBuoy, keywords: "help lookup find customer reply macro email ticket" },
  { name: "Marketing", path: "/marketing", icon: Megaphone, keywords: "social posts agents ai spend credits instagram threads facebook pipeline tokens" },
  { name: "Messages", path: "/messages", icon: Mail, keywords: "email lifecycle welcome nudge trial reminder unsubscribe send campaign" },
  { name: "App controls", path: "/app-controls", icon: SlidersHorizontal, keywords: "feature flags maintenance banner minimum version force update rollout remote config" },
  { name: "System health", path: "/system", icon: Activity, keywords: "status uptime database services paystack resend ai down slow cron jobs" },
  { name: "Alerts", path: "/alerts", icon: BellRing, keywords: "monitor problems warnings email outage down incidents" },
  { name: "Data requests", path: "/data-requests", icon: ClipboardList, keywords: "gdpr dsar delete export privacy consent retention" },
  { name: "Growth", path: "/growth", icon: BarChart3, keywords: "funnel retention cohorts signups activation acquisition" },
  { name: "Analytics", path: "/analytics", icon: BarChart3, keywords: "funnel retention churn events product" },
  { name: "Audit Log", path: "/audit-log", icon: ScrollText, keywords: "history actions security who did" },
  { name: "Ebook", path: "/ebook", icon: BookOpen, keywords: "download lead magnet" },
  { name: "Blog", path: "/blog", icon: FileText, keywords: "articles posts content cms" },
  { name: "New blog post", path: "/blog/new", icon: FileText, keywords: "write article create" },
];

export function AdminSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();

  // Wait for a pause in typing before asking the server who matches.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const people = useSupportLookup(open ? debounced : "");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery("");
      navigate(path);
    },
    [navigate]
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="relative h-9 w-9 md:w-60 md:justify-start md:px-3 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline-flex">Search pages...</span>
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground md:flex">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
        <CommandInput placeholder="Search pages, or type a name or email to find a person..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{people.isFetching ? "Searching..." : "No results found."}</CommandEmpty>
          {debounced.length >= 3 && (people.data?.users?.length ?? 0) > 0 && (
            <CommandGroup heading="People">
              {people.data!.users.map((u) => (
                <CommandItem key={u.id} value={`${debounced} ${u.email} ${u.display_name ?? ""}`} onSelect={() => handleSelect(`/users/${u.id}`)}>
                  <Users className="mr-2 h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{u.display_name || "No name"} <span className="text-muted-foreground">{u.email}</span></span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Pages">
            {pages.map((page) => (
              <CommandItem
                key={page.path}
                value={`${page.name} ${page.keywords}`}
                onSelect={() => handleSelect(page.path)}
              >
                <page.icon className="mr-2 h-4 w-4" />
                {page.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
