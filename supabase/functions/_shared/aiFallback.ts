/**
 * A backup AI provider for the marketing system.
 *
 * Anthropic is the primary. When it fails for a reason that is not our own bug
 * (out of credit, key rejected, rate limited, overloaded, down, unreachable),
 * the same prompt is sent to OpenAI so the pipeline keeps moving. A request
 * that Anthropic rejected as malformed is NOT retried elsewhere: that is a bug
 * to fix, and a second provider would only hide it.
 *
 * The switch is never silent. A run that used the backup is logged with the
 * model "openai:<model>" and a note saying why, and the monitor raises a
 * warning while it keeps happening (see marketingRules, "ai-fallback").
 *
 * The compliance reviewers (S13, S13H) have veto power over what is posted, so by
 * default they do NOT fall back: if Anthropic is unavailable they fail, and the
 * pipeline holds the post for human review instead of letting a different, weaker
 * model approve it. Change AI_FALLBACK_SKIP_AGENTS to alter that.
 *
 * Pure apart from callOpenAI, so the decisions are unit-tested.
 */

export type FailureKind = "credits" | "auth" | "rate_limit" | "overloaded" | "server" | "network";
export type FailureVerdict = { fallback: true; kind: FailureKind } | { fallback: false; kind: "request" };

/** Should a failed Anthropic call be retried on the backup? `status` is null when the request never got an answer. */
export function classifyAnthropicFailure(status: number | null, body = ""): FailureVerdict {
  if (status === null) return { fallback: true, kind: "network" };
  const text = body.toLowerCase();
  if (status === 402 || /credit balance|billing|payment required|insufficient (credit|fund|quota)|quota exceeded/.test(text)) {
    return { fallback: true, kind: "credits" };
  }
  if (status === 401 || status === 403) return { fallback: true, kind: "auth" };
  if (status === 429) return { fallback: true, kind: "rate_limit" };
  if (status === 529 || /overloaded/.test(text)) return { fallback: true, kind: "overloaded" };
  if (status >= 500) return { fallback: true, kind: "server" };
  return { fallback: false, kind: "request" };
}

export const FALLBACK_NOTE_PREFIX = "fallback: anthropic ";
export const OPENAI_MODEL_PREFIX = "openai:";

export const fallbackNote = (kind: FailureKind) => `${FALLBACK_NOTE_PREFIX}${kind}`;

export function parseFallbackKind(note: string | null | undefined): FailureKind | null {
  if (!note || !note.startsWith(FALLBACK_NOTE_PREFIX)) return null;
  const kind = note.slice(FALLBACK_NOTE_PREFIX.length).trim();
  return (["credits", "auth", "rate_limit", "overloaded", "server", "network"] as const).find((k) => k === kind) ?? null;
}

// ---- configuration ---------------------------------------------------------------------------------------

/**
 * A best guess at a sensible, inexpensive model. Set OPENAI_MODEL to the one you want; if this name is
 * not available to your account the backup run fails with OpenAI's own message and the monitor reports it.
 */
export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
/** Estimated dollars per million tokens, used only for the daily spend caps. Override with OPENAI_PRICE_IN / OPENAI_PRICE_OUT. */
export const DEFAULT_OPENAI_PRICE = { in: 0.75, out: 4.5 };
export const DEFAULT_SKIPPED_AGENTS = "S13,S13H";

export interface FallbackEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_MODEL_STRONG?: string;
  AI_FALLBACK_SKIP_AGENTS?: string;
  OPENAI_PRICE_IN?: string;
  OPENAI_PRICE_OUT?: string;
}

export function readFallbackEnv(get: (name: string) => string | undefined): FallbackEnv {
  const v = (n: string) => get(n)?.trim() || undefined;
  return {
    OPENAI_API_KEY: v("OPENAI_API_KEY"),
    OPENAI_MODEL: v("OPENAI_MODEL"),
    OPENAI_MODEL_STRONG: v("OPENAI_MODEL_STRONG"),
    AI_FALLBACK_SKIP_AGENTS: get("AI_FALLBACK_SKIP_AGENTS"),
    OPENAI_PRICE_IN: v("OPENAI_PRICE_IN"),
    OPENAI_PRICE_OUT: v("OPENAI_PRICE_OUT"),
  };
}

export function skippedAgents(env: FallbackEnv): Set<string> {
  const raw = env.AI_FALLBACK_SKIP_AGENTS ?? DEFAULT_SKIPPED_AGENTS;
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

/** The backup is used only when a key is set and the agent has not been excluded. */
export function fallbackAllowed(env: FallbackEnv, agentId: string): boolean {
  return !!env.OPENAI_API_KEY && !skippedAgents(env).has(agentId);
}

/** The strongest Anthropic tier (Opus) maps to OPENAI_MODEL_STRONG when set; everything else uses OPENAI_MODEL. */
export function pickOpenAiModel(anthropicModel: string, env: FallbackEnv): string {
  const base = env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  return /opus/i.test(anthropicModel) ? env.OPENAI_MODEL_STRONG ?? base : base;
}

// ---- talking to OpenAI -------------------------------------------------------------------------------------

export interface OpenAiRequestInput {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  /** Ask for a single JSON object. Not for prompts whose answer is an array. */
  json: boolean;
}

/**
 * max_completion_tokens counts hidden reasoning as well as the visible answer on reasoning models, so it is set
 * to twice what the agent was allowed for output, up to a ceiling. A run that still runs out is reported, not
 * silently truncated (see parseOpenAiResponse).
 */
export function buildOpenAiRequest(i: OpenAiRequestInput): Record<string, unknown> {
  return {
    model: i.model,
    messages: [
      { role: "system", content: i.system },
      { role: "user", content: i.user },
    ],
    max_completion_tokens: Math.min(Math.max(i.maxTokens, 256) * 2, 16_000),
    ...(i.json ? { response_format: { type: "json_object" } } : {}),
  };
}

export interface OpenAiResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export function parseOpenAiResponse(data: unknown): OpenAiResult {
  // deno-lint-ignore no-explicit-any
  const d = data as any;
  const choice = d?.choices?.[0];
  const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
  if (choice?.finish_reason === "length") throw new Error("openai ran out of room before finishing its answer");
  if (!text.trim()) throw new Error(`openai returned no text${choice?.message?.refusal ? ` (refused: ${String(choice.message.refusal).slice(0, 120)})` : ""}`);
  return { text, tokensIn: Number(d?.usage?.prompt_tokens ?? 0), tokensOut: Number(d?.usage?.completion_tokens ?? 0) };
}

export function openAiCost(tokensIn: number, tokensOut: number, env: FallbackEnv): number {
  const num = (s: string | undefined, fallback: number) => {
    const n = Number(s);
    return s !== undefined && Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const priceIn = num(env.OPENAI_PRICE_IN, DEFAULT_OPENAI_PRICE.in);
  const priceOut = num(env.OPENAI_PRICE_OUT, DEFAULT_OPENAI_PRICE.out);
  return (tokensIn / 1e6) * priceIn + (tokensOut / 1e6) * priceOut;
}

export async function callOpenAI(apiKey: string, body: Record<string, unknown>): Promise<OpenAiResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return parseOpenAiResponse(await res.json());
}
