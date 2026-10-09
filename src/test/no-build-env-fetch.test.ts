import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/*
 * Regression guard for the dead Subscriptions screen: the panel talks to
 * Supabase through the client in integrations/supabase/client.ts, which carries
 * its own URL and key. Reading these from import.meta.env at call sites produced
 * `https://admin.gosafespend.com/undefined/functions/v1/...` in production.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("build-time environment variables", () => {
  it("are not used to address Supabase from application code", () => {
    const offenders = sourceFiles(join(process.cwd(), "src")).filter((file) =>
      /import\.meta\.env\.VITE_SUPABASE_(URL|PUBLISHABLE_KEY)/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("do not hard-code the project URL outside the generated client", () => {
    const offenders = sourceFiles(join(process.cwd(), "src"))
      .filter((file) => !file.split("\\").join("/").endsWith("integrations/supabase/client.ts"))
      .filter((file) => readFileSync(file, "utf8").includes("qeogqvjqvafbzufanwki.supabase.co/functions"));
    expect(offenders).toEqual([]);
  });
});
