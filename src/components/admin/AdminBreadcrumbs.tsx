import { useLocation, Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Users",
  transactions: "Transactions",
  waitlist: "Waitlist",
  subscriptions: "Subscriptions",
  billing: "Billing",
  growth: "Growth",
  "data-requests": "Data requests",
  support: "Support",
  marketing: "Marketing",
  analytics: "Analytics",
  "audit-log": "Audit Log",
  blog: "Blog",
  editor: "Editor",
  new: "New post",
  ebook: "Ebook",
  settings: "Settings",
};

export function AdminBreadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Build breadcrumb items from path segments
  const items: { label: string; path: string }[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // A UUID is a user under /users and a post under /blog/editor.
    if (/^[0-9a-f-]{36}$/i.test(segment)) {
      items.push({ label: segments[0] === "blog" ? "Post" : "User details", path: currentPath });
      continue;
    }

    // "editor" has no page of its own; /blog/editor would be a dead link.
    if (segment === "editor") continue;

    const label = routeLabels[segment] || segment;
    items.push({ label, path: currentPath });
  }

  if (items.length <= 1) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <BreadcrumbItem key={item.path}>
              {!isLast ? (
                <>
                  <BreadcrumbLink asChild>
                    <Link to={item.path}>{item.label}</Link>
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
