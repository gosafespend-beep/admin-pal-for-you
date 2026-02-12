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
  analytics: "Analytics",
  "audit-log": "Audit Log",
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

    // UUID segment = user detail
    if (/^[0-9a-f-]{36}$/i.test(segment)) {
      items.push({ label: "User Detail", path: currentPath });
      continue;
    }

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
