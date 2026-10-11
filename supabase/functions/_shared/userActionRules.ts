/**
 * Decision rules for admin actions on user accounts.
 *
 * Pure (no Deno or network imports) so they can be unit-tested under Node and
 * so every rule is visible in one place. The edge function gathers the facts
 * (who is acting, who is the target, how many admins exist, whether the target
 * has a paid subscription) and asks this module whether the action may proceed.
 *
 * Before this existed the function would happily let an admin delete or demote
 * themselves, delete the last admin, suspend a colleague, or delete a paying
 * subscriber, with no reason recorded.
 */

export type UserAction =
  | "suspend"
  | "unsuspend"
  | "delete"
  | "promote"
  | "demote"
  | "resend_confirmation"
  | "revoke_session";

export const USER_ACTIONS: readonly UserAction[] = [
  "suspend",
  "unsuspend",
  "delete",
  "promote",
  "demote",
  "resend_confirmation",
  "revoke_session",
];

/** Actions that change access or destroy data: a written reason is mandatory. */
const REASON_REQUIRED: ReadonlySet<UserAction> = new Set(["suspend", "delete", "promote", "demote"]);

export const MIN_REASON_LENGTH = 10;
export const MAX_REASON_LENGTH = 500;
export const MAX_SUSPEND_DAYS = 365;

export interface ActionFacts {
  action: unknown;
  adminId: string;
  targetId: string;
  targetEmail: string | null;
  targetIsAdmin: boolean;
  targetEmailConfirmed: boolean;
  adminCount: number;
  reason: unknown;
  data: unknown;
  /** The email typed by the admin to confirm a deletion. */
  confirmEmail: unknown;
  /** True when the target has an active paid subscription (Paystack or a store). */
  hasPaidSubscription: boolean;
}

export type ActionDecision =
  | { ok: true; action: UserAction; reason: string; suspendDays?: number; sessionId?: string }
  | { ok: false; status: number; error: string };

const deny = (status: number, error: string): ActionDecision => ({ ok: false, status, error });

export function isUserAction(value: unknown): value is UserAction {
  return typeof value === "string" && (USER_ACTIONS as readonly string[]).includes(value);
}

export function parseSuspendDays(data: unknown): number | null {
  const raw = (data as { duration?: unknown } | null | undefined)?.duration;
  if (raw === undefined || raw === null) return 30;
  const days = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > MAX_SUSPEND_DAYS) return null;
  return days;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function decideUserAction(f: ActionFacts): ActionDecision {
  if (!isUserAction(f.action)) return deny(400, "Unknown action");
  const action = f.action;

  const reason = typeof f.reason === "string" ? f.reason.trim() : "";
  if (REASON_REQUIRED.has(action)) {
    if (reason.length < MIN_REASON_LENGTH) {
      return deny(400, `A reason of at least ${MIN_REASON_LENGTH} characters is required for this action`);
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return deny(400, `The reason must be ${MAX_REASON_LENGTH} characters or fewer`);
    }
  }

  const isSelf = f.adminId === f.targetId;

  switch (action) {
    case "suspend": {
      if (isSelf) return deny(400, "You can't suspend your own account");
      if (f.targetIsAdmin) return deny(409, "Remove this user's admin role before suspending them");
      const days = parseSuspendDays(f.data);
      if (days === null) return deny(400, `Suspension must be a whole number of days between 1 and ${MAX_SUSPEND_DAYS}`);
      return { ok: true, action, reason, suspendDays: days };
    }

    case "delete": {
      if (isSelf) return deny(400, "You can't delete your own account from the admin panel");
      if (f.targetIsAdmin) return deny(409, "Remove this user's admin role before deleting them");
      if (f.hasPaidSubscription) {
        return deny(
          409,
          "This user has an active paid subscription. Cancel it with the payment provider first, then delete the account",
        );
      }
      const typed = typeof f.confirmEmail === "string" ? f.confirmEmail.trim().toLowerCase() : "";
      if (!f.targetEmail || typed !== f.targetEmail.toLowerCase()) {
        return deny(400, "Type the user's email address exactly to confirm deletion");
      }
      return { ok: true, action, reason };
    }

    case "promote": {
      if (f.targetIsAdmin) return deny(409, "This user is already an admin");
      if (!f.targetEmailConfirmed) return deny(409, "Only users with a confirmed email can become admins");
      return { ok: true, action, reason };
    }

    case "demote": {
      if (isSelf) return deny(400, "You can't remove your own admin role");
      if (!f.targetIsAdmin) return deny(409, "This user is not an admin");
      if (f.adminCount <= 1) return deny(409, "You can't remove the last admin");
      return { ok: true, action, reason };
    }

    case "revoke_session": {
      const sessionId = (f.data as { sessionId?: unknown } | null | undefined)?.sessionId;
      if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) return deny(400, "A valid sessionId is required");
      return { ok: true, action, reason, sessionId };
    }

    case "unsuspend":
      return { ok: true, action, reason };

    case "resend_confirmation":
      if (f.targetEmailConfirmed) return deny(409, "This user's email is already confirmed");
      return { ok: true, action, reason };
  }
}
