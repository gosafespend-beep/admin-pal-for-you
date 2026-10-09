/**
 * Rules for the data-request queue (someone asking for a copy of their data,
 * deletion, correction, or to stop marketing). Pure, so they are unit-tested
 * under Node and every rule is visible in one place.
 */

export const REQUEST_TYPES = ["export", "delete", "rectify", "opt_out", "other"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const CHANNELS = ["email", "in_app", "other"] as const;
export type Channel = (typeof CHANNELS)[number];

export type RequestStatus = "received" | "in_progress" | "completed" | "rejected";
export type RequestAction = "verify" | "export" | "complete" | "reject";

/** How long to answer. 30 days is a common default; it is configurable per request (1-90) because the deadline depends on the law that applies to the person. */
export const DEFAULT_DUE_DAYS = 30;
export const MAX_DUE_DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NewRequestInput {
  type?: unknown;
  requesterEmail?: unknown;
  channel?: unknown;
  receivedAt?: unknown;
  dueDays?: unknown;
}

export type NewRequestResult =
  | { ok: true; value: { type: RequestType; email: string; channel: Channel; receivedAt: Date; dueAt: Date } }
  | { ok: false; error: string };

export function validateNewRequest(input: NewRequestInput, now: Date = new Date()): NewRequestResult {
  if (!REQUEST_TYPES.includes(input.type as RequestType)) return { ok: false, error: "Choose a request type" };
  const email = typeof input.requesterEmail === "string" ? input.requesterEmail.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 320) return { ok: false, error: "Enter the requester's email address" };
  const channel = (input.channel ?? "email") as Channel;
  if (!CHANNELS.includes(channel)) return { ok: false, error: "Unknown channel" };

  let receivedAt = now;
  if (input.receivedAt !== undefined && input.receivedAt !== null && input.receivedAt !== "") {
    const parsed = new Date(String(input.receivedAt));
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: "The received date isn't valid" };
    if (parsed.getTime() > now.getTime() + DAY) return { ok: false, error: "The received date can't be in the future" };
    if (parsed.getTime() < now.getTime() - 730 * DAY) return { ok: false, error: "The received date is more than two years ago" };
    receivedAt = parsed;
  }

  const rawDays = input.dueDays ?? DEFAULT_DUE_DAYS;
  const days = typeof rawDays === "number" ? rawDays : Number(rawDays);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DUE_DAYS) {
    return { ok: false, error: `The deadline must be a whole number of days from 1 to ${MAX_DUE_DAYS}` };
  }

  return {
    ok: true,
    value: { type: input.type as RequestType, email, channel, receivedAt, dueAt: new Date(receivedAt.getTime() + days * DAY) },
  };
}

export interface RequestFacts {
  type: RequestType;
  status: RequestStatus;
  identityVerifiedAt: string | null;
  exportGeneratedAt: string | null;
  /** A matching account was found when the request was logged. */
  hasSubject: boolean;
  /** That account still exists now (relevant to deletion). */
  subjectStillExists: boolean;
}

export interface ActionInput {
  note?: unknown;
  resolution?: unknown;
}

export type ActionDecision =
  | { ok: true; text: string }
  | { ok: false; status: number; error: string };

const deny = (status: number, error: string): ActionDecision => ({ ok: false, status, error });
const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function decideRequestAction(action: unknown, f: RequestFacts, input: ActionInput = {}): ActionDecision {
  if (action !== "verify" && action !== "export" && action !== "complete" && action !== "reject") {
    return deny(400, "Unknown action");
  }
  if (f.status === "completed" || f.status === "rejected") return deny(409, "This request is already closed");

  switch (action) {
    case "verify": {
      if (f.identityVerifiedAt) return deny(409, "Identity is already verified for this request");
      const note = clean(input.note);
      if (note.length < 5) return deny(400, "Say how you confirmed it's them (for example: replied from the registered email)");
      if (note.length > 300) return deny(400, "Keep the verification note under 300 characters");
      return { ok: true, text: note };
    }

    case "export": {
      if (f.type !== "export") return deny(409, "Only copy-of-my-data requests can generate an export");
      if (!f.identityVerifiedAt) return deny(409, "Verify the requester's identity before exporting their data");
      if (!f.hasSubject) return deny(409, "No account matches this email, so there is nothing to export");
      return { ok: true, text: "" };
    }

    case "complete": {
      if (f.type !== "other" && !f.identityVerifiedAt) return deny(409, "Verify the requester's identity before completing this request");
      const resolution = clean(input.resolution);
      if (resolution.length > 500) return deny(400, "Keep the resolution under 500 characters");
      if (f.type === "export" && !f.exportGeneratedAt) return deny(409, "Generate the export before completing this request");
      if (f.type === "delete" && f.hasSubject && f.subjectStillExists) {
        return deny(409, "The account still exists. Delete it from the user's page first, or reject the request with a reason");
      }
      if (f.type !== "export" && f.type !== "delete" && resolution.length < 10) {
        return deny(400, "Describe what was done (at least 10 characters)");
      }
      return { ok: true, text: resolution };
    }

    case "reject": {
      const resolution = clean(input.resolution);
      if (resolution.length < 10) return deny(400, "Give the reason for refusing (at least 10 characters)");
      if (resolution.length > 500) return deny(400, "Keep the reason under 500 characters");
      return { ok: true, text: resolution };
    }
  }
}

export type DueTone = "ok" | "soon" | "overdue" | "closed";

/** How urgent a request is: days left, or how late it is. */
export function dueState(dueAt: string | Date, status: RequestStatus, now: Date = new Date()): { tone: DueTone; days: number } {
  if (status === "completed" || status === "rejected") return { tone: "closed", days: 0 };
  const days = Math.ceil((new Date(dueAt).getTime() - now.getTime()) / DAY);
  if (days < 0) return { tone: "overdue", days: -days };
  return { tone: days <= 7 ? "soon" : "ok", days };
}
