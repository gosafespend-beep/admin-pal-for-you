/**
 * "What could be wrong with this person's account?" for the Support view.
 *
 * Reads only what the admin panel already holds (account state, subscription,
 * store entitlements, milestones) plus the app's own answer to "can they save
 * right now?" (public.can_write via admin_support_snapshot). It states facts and
 * leaves the conclusion to the person on the other end of the email.
 */

export type Severity = "problem" | "warning" | "info" | "ok";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface WriteSnapshot {
  enforcementOn: boolean;
  isPremium: boolean;
  graceUntil: string | null;
  canWrite: boolean;
}

export interface DiagnosisInput {
  user: { email_confirmed_at: string | null; banned_until: string | null; last_sign_in_at: string | null };
  subscription: { status: string; trial_end: string | null; current_period_end: string | null; cancelled_at: string | null } | null;
  entitlements: Array<{ is_active: boolean; expires_at: string | null; store: string }>;
  milestones: { onboardingComplete: string | null };
  totalTransactions: number;
  marketingEmails: boolean | null;
  snapshot: WriteSnapshot | null;
}

const DAY = 24 * 60 * 60 * 1000;
const RANK: Record<Severity, number> = { problem: 0, warning: 1, info: 2, ok: 3 };

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const past = (iso: string | null | undefined, now: Date) => !!iso && new Date(iso).getTime() < now.getTime();

export function diagnose(input: DiagnosisInput, now: Date = new Date()): Finding[] {
  const out: Finding[] = [];
  const add = (id: string, severity: Severity, title: string, detail: string) => out.push({ id, severity, title, detail });
  const { user, subscription: sub, snapshot } = input;

  if (user.banned_until && !past(user.banned_until, now)) {
    add("suspended", "problem", "Account is suspended", `They cannot sign in until ${day(user.banned_until)}.`);
  }
  if (!user.email_confirmed_at) {
    add("unconfirmed", "problem", "Email not confirmed", "They cannot sign in until they confirm their email. A new confirmation email can be sent from their profile.");
  }

  if (snapshot) {
    if (!snapshot.canWrite) {
      add("write-blocked", "problem", "The app is blocking them from saving changes",
        "Write limits are switched on, they have no active subscription or trial, and no grace period applies.");
    } else if (!snapshot.enforcementOn) {
      add("write-open", "info", "Saving is allowed for everyone right now",
        "Write limits are switched off across the app, so a problem saving is not about their plan. Look for another cause (connection, app version, a bug).");
    } else if (!snapshot.isPremium && snapshot.graceUntil) {
      add("write-grace", "info", "Saving is allowed only by a grace period", `Their grace period ends ${day(snapshot.graceUntil)}.`);
    }
  }

  if (sub) {
    const hasPaidStore = input.entitlements.some((e) => e.is_active && !past(e.expires_at, now));
    if (sub.status === "trialing" && past(sub.trial_end, now) && !hasPaidStore) {
      add("trial-ended", "warning", "Trial has ended", `Their trial ended ${day(sub.trial_end!)} and they have not subscribed.`);
    }
    if (sub.status === "active" && past(sub.current_period_end, now)) {
      add("period-lapsed", "warning", "Paid period ended without a renewal on record",
        `The period ended ${day(sub.current_period_end!)}. If they say they were charged, check Paystack for a payment notification we missed.`);
    }
    if (sub.status === "active" && sub.cancelled_at) {
      add("cancelled", "info", "They have cancelled",
        sub.current_period_end ? `Cancelled ${day(sub.cancelled_at)}; access runs to ${day(sub.current_period_end)}.` : `Cancelled ${day(sub.cancelled_at)}.`);
    }
  }
  for (const e of input.entitlements) {
    if (e.is_active && past(e.expires_at, now)) {
      add(`store-stale-${e.store}`, "warning", `${e.store} subscription looks out of date`,
        `It is still marked active but expired ${day(e.expires_at!)}. An expiry or renewal notification from the store may have been missed.`);
    }
  }

  if (!user.last_sign_in_at) {
    add("never-signed-in", "info", "Has never signed in", "They created the account but have not signed in since.");
  } else if (now.getTime() - new Date(user.last_sign_in_at).getTime() > 30 * DAY) {
    add("dormant", "info", "Has not signed in for over 30 days", `Last sign-in ${day(user.last_sign_in_at)}.`);
  }
  if (input.milestones.onboardingComplete && input.totalTransactions === 0) {
    add("no-first-transaction", "info", "Finished setup but has never logged a transaction",
      "A short how-to reply is often all they need.");
  }
  if (input.marketingEmails === false) {
    add("no-marketing", "info", "Opted out of marketing emails", "Replies about their question are fine; do not send promotions.");
  }

  if (!out.some((f) => f.severity === "problem" || f.severity === "warning")) {
    add("nothing", "ok", "Nothing looks wrong with the account", "No sign-in, billing or access issues were found. Ask them what they are seeing.");
  }
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
