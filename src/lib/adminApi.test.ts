import { describe, expect, it } from "vitest";
import { withQuery } from "./adminApi";

describe("withQuery", () => {
  it("appends only the parameters that have a value", () => {
    expect(withQuery("admin-users", { page: 2, search: "", role: undefined, sortBy: "created_at" })).toBe(
      "admin-users?page=2&sortBy=created_at",
    );
  });

  it("returns the bare name when there is nothing to add", () => {
    expect(withQuery("admin-stats")).toBe("admin-stats");
    expect(withQuery("admin-stats", {})).toBe("admin-stats");
  });
});

describe("AdminApiError", () => {
  it("carries the HTTP status so retries can be decided", async () => {
    const { AdminApiError } = await import("./adminApi");
    const error = new AdminApiError("Access denied", 403);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(403);
    expect(error.message).toBe("Access denied");
  });
});
