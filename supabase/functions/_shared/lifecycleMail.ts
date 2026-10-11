/**
 * Sends one lifecycle email through Resend. Shared by the scheduled sender and
 * the admin "send me a test" button.
 *
 * `fatal` is true when carrying on would be pointless or harmful (the key was
 * rejected, or the provider is rate limiting us), so the caller stops the run
 * instead of working through every remaining person and failing each one.
 */

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** For marketing email: the one-click unsubscribe endpoint (see RFC 8058). */
  oneClickUrl?: string;
  /** The page a person lands on if their mail app shows an unsubscribe link instead. */
  pageUrl?: string;
}

export interface MailResult {
  ok: boolean;
  id?: string;
  error?: string;
  fatal?: boolean;
}

export async function sendLifecycleMail(msg: MailInput): Promise<MailResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set", fatal: true };

  const headers: Record<string, string> = {};
  if (msg.oneClickUrl) {
    headers["List-Unsubscribe"] = msg.pageUrl ? `<${msg.oneClickUrl}>, <${msg.pageUrl}>` : `<${msg.oneClickUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Safe Spend <notifications@gosafespend.com>",
        reply_to: "info@gosafespend.com",
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(Object.keys(headers).length ? { headers } : {}),
      }),
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: true, id: typeof body?.id === "string" ? body.id : undefined };
    }
    await res.body?.cancel();
    return { ok: false, error: `Email provider answered ${res.status}`, fatal: res.status === 401 || res.status === 403 || res.status === 429 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email could not be sent" };
  }
}
