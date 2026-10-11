/**
 * Validation for the marketing pause/resume buttons, and how a database
 * refusal is explained to the person who pressed one. Pure, so it is
 * unit-tested; the same list of actions is used by the edge function and the
 * browser.
 */

export type ControlAction = "pause" | "resume";
export type ControlScope = "agent" | "channel" | "all";

export interface ControlRequest {
  action: ControlAction;
  scope: ControlScope;
  /** Agent id (for example "S4R") or channel name (for example "threads"). Absent for "all". */
  target?: string;
  reason: string;
}

export type ControlResult = { ok: true; value: ControlRequest } | { ok: false; error: string };

const TARGET_RE = /^[A-Za-z0-9_-]{1,40}$/;

/** A pause is audited and silences the system, so it needs a real reason; a resume needs a shorter one. */
export const MIN_PAUSE_REASON = 10;
export const MIN_RESUME_REASON = 5;
export const MAX_REASON = 300;

export function validateControl(input: unknown): ControlResult {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const action = b.action;
  if (action !== "pause" && action !== "resume") return { ok: false, error: "Choose pause or resume" };
  const scope = b.scope;
  if (scope !== "agent" && scope !== "channel" && scope !== "all") return { ok: false, error: "Choose what to " + action };

  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  const min = action === "pause" ? MIN_PAUSE_REASON : MIN_RESUME_REASON;
  if (reason.length < min) return { ok: false, error: `Say why (at least ${min} characters)` };
  if (reason.length > MAX_REASON) return { ok: false, error: `Keep the reason under ${MAX_REASON} characters` };

  if (scope === "all") {
    if (b.target !== undefined && b.target !== null && b.target !== "") return { ok: false, error: "Pausing everything takes no target" };
    return { ok: true, value: { action, scope, reason } };
  }
  if (typeof b.target !== "string" || !TARGET_RE.test(b.target)) return { ok: false, error: `Choose which ${scope}` };
  return { ok: true, value: { action, scope, target: b.target, reason } };
}

/** Turns the database's refusal (its message starts with a code) into a status and a plain sentence. */
export function explainRefusal(message: string): { status: number; error: string } | null {
  const m = /^(not_found|already|deprecated|bad_scope):\s*(.*)$/s.exec(message.trim());
  if (!m) return null;
  const [, code, rest] = m;
  if (code === "not_found") return { status: 404, error: capitalise(rest) };
  if (code === "already") return { status: 409, error: capitalise(rest) };
  if (code === "deprecated") return { status: 409, error: capitalise(rest) };
  return { status: 400, error: "Unknown scope" };
}

const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) + (s.endsWith(".") ? "" : ".") : s);
