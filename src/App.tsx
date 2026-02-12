import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import { AdminLayout } from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Users from "./pages/admin/Users";
import UserDetail from "./pages/admin/UserDetail";
import Transactions from "./pages/admin/Transactions";
import Waitlist from "./pages/admin/Waitlist";
import Subscriptions from "./pages/admin/Subscriptions";
import Settings from "./pages/admin/Settings";
import Analytics from "./pages/admin/Analytics";
import AuditLog from "./pages/admin/AuditLog";
import BlogPosts from "./pages/admin/BlogPosts";
import BlogEditor from "./pages/admin/BlogEditor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="waitlist" element={<Waitlist />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="blog" element={<BlogPosts />} />
            <Route path="blog/new" element={<BlogEditor />} />
            <Route path="blog/editor/:id" element={<BlogEditor />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
