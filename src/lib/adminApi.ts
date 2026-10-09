import { supabase } from "@/integrations/supabase/client";

/**
 * The one way the panel calls its edge functions.
 *
 * supabase-js attaches the signed-in session's token itself, so nothing here
 * builds an Authorization header or reads build-time environment variables.
 * (A raw fetch built from the build-time Supabase URL variable in
 * the subscriptions hook resolved to `/undefined/functions/v1/...` in the
 * production build and left that screen permanently broken.)
 *
 * supabase-js reports every non-2xx response as "Edge Function returned a
 * non-2xx status code"; the real reason is in the response body, so it is
 * unwrapped here and thrown as an ordinary Error.
 */
export interface InvokeOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

export function withQuery(
  name: string,
  query?: InvokeOptions["query"],
): string {
  if (!query) return name;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${name}?${qs}` : name;
}

async function messageFrom(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "Request failed";
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).clone().json();
      if (body && typeof body.error === "string") return body.error;
    } catch {
      /* body was not JSON; keep the generic message */
    }
  }
  return fallback;
}

export async function invokeAdmin<T = unknown>(
  name: string,
  options: InvokeOptions = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    withQuery(name, options.query),
    {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      body: options.body as Record<string, unknown> | undefined,
    },
  );
  if (error) throw new Error(await messageFrom(error));
  if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}
