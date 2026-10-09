import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LayoutDashboard, Users, Receipt, CreditCard, ClipboardList, Settings, FileText, BarChart3, ScrollText, BookOpen } from "lucide-react";
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
  { name: "Growth", path: "/growth", icon: BarChart3, keywords: "funnel retention cohorts signups activation acquisition" },
  { name: "Analytics", path: "/analytics", icon: BarChart3, keywords: "funnel retention churn events product" },
  { name: "Audit Log", path: "/audit-log", icon: ScrollText, keywords: "history actions security who did" },
  { name: "Ebook", path: "/ebook", icon: BookOpen, keywords: "download lead magnet" },
  { name: "Blog", path: "/blog", icon: FileText, keywords: "articles posts content cms" },
  { name: "New blog post", path: "/blog/new", icon: FileText, keywords: "write article create" },
];

export function AdminSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search admin pages..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
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
