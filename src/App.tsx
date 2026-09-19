import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AdminLayout } from "./components/admin/AdminLayout";

// Lazy load all page components
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Users = lazy(() => import("./pages/admin/Users"));
const UserDetail = lazy(() => import("./pages/admin/UserDetail"));
const Transactions = lazy(() => import("./pages/admin/Transactions"));
const Waitlist = lazy(() => import("./pages/admin/Waitlist"));
const Subscriptions = lazy(() => import("./pages/admin/Subscriptions"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog"));
const Ebook = lazy(() => import("./pages/admin/Ebook"));
const BlogPosts = lazy(() => import("./pages/admin/BlogPosts"));
const BlogEditor = lazy(() => import("./pages/admin/BlogEditor"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

const RootLayout = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SuspenseWrapper>
        <Outlet />
      </SuspenseWrapper>
    </TooltipProvider>
  </QueryClientProvider>
);

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/login", element: <AdminLogin /> },
      {
        path: "/",
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <Dashboard /> },
          { path: "users", element: <Users /> },
          { path: "users/:id", element: <UserDetail /> },
          { path: "transactions", element: <Transactions /> },
          { path: "waitlist", element: <Waitlist /> },
          { path: "subscriptions", element: <Subscriptions /> },
          { path: "analytics", element: <Analytics /> },
          { path: "audit-log", element: <AuditLog /> },
          { path: "ebook", element: <Ebook /> },
          { path: "blog", element: <BlogPosts /> },
          { path: "blog/new", element: <BlogEditor /> },
          { path: "blog/editor/:id", element: <BlogEditor /> },
          { path: "settings", element: <Settings /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const App = () => <RouterProvider router={router} />;

export default App;
