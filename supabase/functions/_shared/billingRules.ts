/**
 * Billing rules shared by the admin functions. Pure (no Deno or network
 * imports) so they are unit-tested under Node.
 */

/**
 * A subscription row keeps status "trialing" long after its trial_end has
 * passed; nothing flips it. Anything that counts or filters by status has to
 * look at the date too, or dead trials are reported as live. (At the time this
 * was written, 11 of 11 "trialing" rows were already over.)
 */
export function effectiveStatus(status: string, trialEnd: string | null | undefined, now: number = Date.now()): string {
  if (status === "trialing" && trialEnd && new Date(trialEnd).getTime() <= now) return "expired";
  return status;
}

export type PaystackAction = "cancel" | "reactivate";

export interface PaystackRequest {
  /** Path under https://api.paystack.co/subscription/ */
  path: "disable" | "enable";
  body: { code: string; token: string };
}

/**
 * Cancelling or restoring a Paystack-billed subscription must happen at
 * Paystack, otherwise the customer keeps being charged (or stops being charged
 * while we show them as active). Paystack identifies the subscription by its
 * code plus the email token issued with it.
 */
export function paystackRequest(
  action: PaystackAction,
  code: string | null | undefined,
  token: string | null | undefined,
): { ok: true; request: PaystackRequest } | { ok: false; error: string } {
  if (!code) return { ok: false, error: "This subscription has no Paystack code" };
  if (!token) return { ok: false, error: "This subscription has no Paystack email token, so it can't be changed from here" };
  return {
    ok: true,
    request: { path: action === "cancel" ? "disable" : "enable", body: { code, token } },
  };
}
