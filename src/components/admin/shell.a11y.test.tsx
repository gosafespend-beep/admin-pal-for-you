import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { NeedsAttention } from "./NeedsAttention";
import { PageErrorBoundary } from "./PageErrorBoundary";

// The shell's data hooks are replaced so these tests are about structure and accessibility, not the network.
// jsdom cannot compute colours, so contrast is checked in a real browser (Lighthouse), not here. Landmarks are checked
// once at page level, so the per-component "region" rule is off.
const AXE = { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } };

const summary = vi.hoisted(() => ({ value: { needsAttention: 3, problems: 1, warnings: 2, paused: 0, tone: "problem" as const } }));
const alerts = vi.hoisted(() => ({
  value: { active: [] as unknown[], fixed: [], emailTo: "x@y.z", emailConfigured: true, checkEvery: "30 minutes" },
}));
vi.mock("@/hooks/admin/useAdminAlerts", () => ({
  useAlertSummary: () => ({ data: summary.value }),
  useOpsAlerts: () => ({ data: alerts.value, isLoading: false, error: null }),
}));

beforeAll(() => {
  // jsdom has no matchMedia, which the sidebar's mobile detection uses.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false, onchange: null }),
  });
});

const alert = (over: Record<string, unknown>) => ({
  fingerprint: "marketing:ai-credits", source: "marketing", severity: "problem", title: "The AI provider is refusing every run",
  detail: "Add credit.", first_seen_at: "2026-10-09T00:00:00Z", last_seen_at: "2026-10-10T00:00:00Z", seen_count: 3,
  last_notified_at: null, notify_count: 0, acknowledged_until: null, acknowledged_reason: null, resolved_at: null, ...over,
});

describe("AdminSidebar", () => {
  const renderSidebar = () =>
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <SidebarProvider><AdminSidebar onSignOut={() => {}} /></SidebarProvider>
      </MemoryRouter>,
    );

  it("is a named navigation landmark with every control named", async () => {
    const { container } = renderSidebar();
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /collapse the menu/i })).toBeTruthy();
    const results = await axe(container, AXE);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("shows how many alerts are open, readable by a screen reader", () => {
    renderSidebar();
    const link = screen.getByRole("link", { name: /alerts/i });
    expect(link.textContent).toContain("3");
    expect(link.textContent).toContain("3 open");
  });

  it("has no badge when nothing is open", () => {
    summary.value = { needsAttention: 0, problems: 0, warnings: 0, paused: 0, tone: "none" as never };
    renderSidebar();
    expect(screen.getByRole("link", { name: /^alerts$/i })).toBeTruthy();
    summary.value = { needsAttention: 3, problems: 1, warnings: 2, paused: 0, tone: "problem" };
  });
});

describe("NeedsAttention", () => {
  const renderPanel = () => render(<MemoryRouter><NeedsAttention /></MemoryRouter>);

  it("says all is well when nothing is open", async () => {
    alerts.value = { ...alerts.value, active: [] };
    const { container } = renderPanel();
    expect(screen.getByRole("status").textContent).toContain("Nothing needs your attention");
    expect((await axe(container, AXE)).violations).toEqual([]);
  });

  it("lists problems first, links each to where it is fixed, and states severity in words", async () => {
    alerts.value = { ...alerts.value, active: [alert({ severity: "warning", fingerprint: "health:fx-stale", title: "Exchange rates are late" }), alert({})] };
    const { container } = renderPanel();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("2 things need your attention");
    const links = screen.getAllByRole("link").filter((l) => l.getAttribute("href") !== "/alerts");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/marketing", "/system"]);
    expect(links[0].textContent).toContain("(problem)");
    expect((await axe(container, AXE)).violations).toEqual([]);
  });

  it("does not count an alert someone paused on purpose", () => {
    alerts.value = { ...alerts.value, active: [alert({ acknowledged_until: "2999-01-01T00:00:00Z" })] };
    renderPanel();
    expect(screen.getByRole("status").textContent).toContain("1 paused");
  });
});

describe("PageErrorBoundary", () => {
  const Boom = ({ boom }: { boom: boolean }) => {
    if (boom) throw new Error("kaboom");
    return <p>fine</p>;
  };

  it("replaces a crashed page with a plain message and keeps the details out of the way", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <MemoryRouter><PageErrorBoundary resetKey="/a"><Boom boom /></PageErrorBoundary></MemoryRouter>,
    );
    expect(screen.getByRole("alert").textContent).toContain("This page hit a problem");
    expect(screen.getByText("kaboom")).toBeTruthy();
    expect((await axe(container, AXE)).violations).toEqual([]);
  });

  it("recovers by itself when the person moves to another page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <MemoryRouter><PageErrorBoundary resetKey="/a"><Boom boom /></PageErrorBoundary></MemoryRouter>,
    );
    expect(screen.queryByText("fine")).toBeNull();
    rerender(<MemoryRouter><PageErrorBoundary resetKey="/b"><Boom boom={false} /></PageErrorBoundary></MemoryRouter>);
    expect(screen.getByText("fine")).toBeTruthy();
  });
});
