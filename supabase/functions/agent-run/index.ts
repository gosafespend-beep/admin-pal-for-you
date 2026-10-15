import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  buildOpenAiRequest, callOpenAI, classifyAnthropicFailure, fallbackAllowed, fallbackNote, OPENAI_MODEL_PREFIX,
  openAiCost, pickOpenAiModel, readFallbackEnv,
} from "../_shared/aiFallback.ts";

// This is the runtime every marketing agent goes through. It was deployed from outside this
// repository; the only change made here is the OpenAI backup (see ../_shared/aiFallback.ts).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const PRICE: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 15, out: 75 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5-20251001": { in: 0.8, out: 4 },
};

const DOCTRINE = `1. Evidence outranks hierarchy.
2. Nothing ships without a hypothesis and a kill threshold.
3. Reversible decisions fast and alone; irreversible decisions slowly and together.
4. Compliance has veto, not opinion.
5. Human review is a budget, not a bottleneck.
6. Every automated action is logged, reversible and attributable.
7. Optimize for the compounding asset, not the spike.
8. Retention is a marketing function.
9. Never fake a user. No fake reviews, no sockpuppets, no undisclosed sponsorship.
10. Agents propose; systems dispose. You have no unilateral spend authority.
11. Kill things on schedule. Continuation requires a case.`;

function buildSystemPrompt(a: any, contractSchema: unknown): string {
  const approvals = (a.needs_approval ?? []).length
    ? (a.needs_approval as string[]).map((s) => `  - ${s}`).join("\n")
    : "  - (none)";
  return [
    a.system_prompt ?? `You are ${a.codename}. ${a.mission}`,
    "",
    "## DOCTRINE",
    DOCTRINE,
    "",
    "## AUTHORITY",
    "You may, without asking:",
    ...(a.autonomous ?? []).map((s: string) => `  - ${s}`),
    "You must get approval for:",
    approvals,
    "You must NEVER:",
    ...(a.forbidden ?? []).map((s: string) => `  - ${s}`),
    "",
    "## OUTPUT CONTRACT",
    "Respond with ONLY valid JSON matching this JSON Schema. No prose, no code fences.",
    JSON.stringify(contractSchema),
    "",
    "State confidence on every recommendation. If uncertain, say so explicitly.",
    "Do not manufacture consensus. Surface disagreement.",
  ].join("\n");
}

function validate(schema: any, value: any, path = ""): string[] {
  const errs: string[] = [];
  if (!schema || typeof schema !== "object") return errs;

  if (schema.type === "object" || schema.properties) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return [`${path || "/"} expected object`];
    }
    for (const req of schema.required ?? []) {
      if (value[req] === undefined || value[req] === null || value[req] === "") {
        errs.push(`${path}/${req} is required`);
      }
    }
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (value[k] !== undefined) errs.push(...validate(sub, value[k], `${path}/${k}`));
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return [`${path} expected array`];
    if (schema.minItems && value.length < schema.minItems) {
      errs.push(`${path} needs at least ${schema.minItems} items`);
    }
    for (const [i, v] of value.entries()) errs.push(...validate(schema.items, v, `${path}[${i}]`));
  } else {
    if (schema.enum && !schema.enum.includes(value)) {
      errs.push(`${path} must be one of ${schema.enum.join(", ")}`);
    }
    if (schema.type === "string" && typeof value !== "string") errs.push(`${path} expected string`);
    if (schema.type === "number" && typeof value !== "number") errs.push(`${path} expected number`);
    if (schema.type === "integer" && !Number.isInteger(value)) errs.push(`${path} expected integer`);
    if (schema.minLength && typeof value === "string" && value.length < schema.minLength) {
      errs.push(`${path} must be at least ${schema.minLength} characters`);
    }
    if (schema.minimum !== undefined && typeof value === "number" && value < schema.minimum) {
      errs.push(`${path} must be >= ${schema.minimum}`);
    }
  }
  return errs;
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

/** Carries the HTTP status and body so the caller can tell "Anthropic is unavailable" from "our request was wrong". */
class AnthropicError extends Error {
  constructor(public status: number, public body: string) {
    super(`anthropic ${status}: ${body.slice(0, 400)}`);
  }
}

async function callClaude(apiKey: string, payload: Record<string, unknown>) {
  const send = (b: Record<string, unknown>) =>
    fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(b),
    });

  let res = await send(payload);
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && /deprecated/i.test(text)) {
      const { temperature: _t, top_p: _p, top_k: _k, ...rest } = payload as any;
      res = await send(rest);
      if (!res.ok) throw new AnthropicError(res.status, await res.text());
      return res;
    }
    throw new AnthropicError(res.status, text);
  }
  return res;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

Deno.serve(async (req: Request): Promise<Response> => {
  const expected = Deno.env.get("AGENT_RUN_SECRET") ?? "";
  if (!expected || (req.headers.get("Authorization") ?? "") !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  const started = Date.now();
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY not set" }),
      { status: 500, headers: { "content-type": "application/json" } });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  const agentId: string = body?.agent;
  const task: string = body?.task ?? "run";
  const input = body?.input ?? {};
  if (!agentId) return new Response("missing agent", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: agent, error: aErr } = await supabase
    .from("sgs_agents_rt").select("*").eq("id", agentId).maybeSingle();
  if (aErr || !agent) {
    return new Response(JSON.stringify({
      ok: false, error: `unknown agent ${agentId}`, detail: aErr?.message ?? null,
    }), { status: 404, headers: { "content-type": "application/json" } });
  }

  if (agent.status === "paused" || agent.status === "deprecated") {
    return new Response(JSON.stringify({ ok: false, error: `agent is ${agent.status}` }),
      { status: 409, headers: { "content-type": "application/json" } });
  }

  const { data: spend } = await supabase
    .from("sgs_agent_spend_today").select("spent_usd, hard_cap_usd_day").eq("id", agentId).maybeSingle();
  if (spend && Number(spend.spent_usd) >= Number(spend.hard_cap_usd_day)) {
    return new Response(JSON.stringify({
      ok: false, error: "daily budget exhausted",
      spent: Number(spend.spent_usd), cap: Number(spend.hard_cap_usd_day),
    }), { status: 429, headers: { "content-type": "application/json" } });
  }

  const { data: contract } = await supabase
    .from("sgs_output_contracts").select("schema").eq("name", agent.contract).maybeSingle();
  const schema = contract?.schema ?? {};

  const idem = `${agentId}:${task}:${Date.now()}`;
  let out: any = null, errText: string | null = null, ok = false;
  let tokensIn = 0, tokensOut = 0, costUsd = 0;
  let modelUsed: string = agent.model;
  let backupNote: string | null = null;

  try {
    const system = buildSystemPrompt(agent, schema);
    const userMessage = JSON.stringify({ task, input });
    let text: string;

    try {
      const res = await callClaude(apiKey, {
        model: agent.model,
        max_tokens: agent.max_tokens,
        system,
        messages: [{ role: "user", content: userMessage }],
      });
      const data = await res.json();
      tokensIn = data.usage?.input_tokens ?? 0;
      tokensOut = data.usage?.output_tokens ?? 0;
      const p = PRICE[agent.model] ?? { in: 3, out: 15 };
      costUsd = (tokensIn / 1e6) * p.in + (tokensOut / 1e6) * p.out;
      text = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    } catch (primary) {
      // A network failure has no status; an HTTP failure carries one.
      const verdict = primary instanceof AnthropicError
        ? classifyAnthropicFailure(primary.status, primary.body)
        : classifyAnthropicFailure(null);
      const env = readFallbackEnv((n) => Deno.env.get(n));
      if (!verdict.fallback || !fallbackAllowed(env, agentId)) throw primary;

      try {
        const model = pickOpenAiModel(agent.model, env);
        const r = await callOpenAI(env.OPENAI_API_KEY!, buildOpenAiRequest({
          model, system, user: userMessage, maxTokens: agent.max_tokens, json: true,
        }));
        text = r.text;
        tokensIn = r.tokensIn;
        tokensOut = r.tokensOut;
        costUsd = openAiCost(tokensIn, tokensOut, env);
        modelUsed = `${OPENAI_MODEL_PREFIX}${model}`;
        backupNote = fallbackNote(verdict.kind);
      } catch (backup) {
        // Keep Anthropic's message first: the monitor reads it to tell "out of credit" from other failures.
        throw new Error(`${message(primary)} | backup (openai) also failed: ${message(backup)}`);
      }
    }

    const parsed = extractJson(text);
    const errs = validate(schema, parsed);

    if (errs.length) {
      errText = `contract violation: ${errs.slice(0, 6).join("; ")}`;
      out = { invalid: parsed, errors: errs };
    } else {
      ok = true;
      out = parsed;
    }
  } catch (e) {
    errText = message(e);
  }

  await supabase.from("sgs_action_log").insert({
    agent_id: agentId, action: task, idempotency_key: idem,
    model: modelUsed, input, output: out, ok,
    // A run that succeeded on the backup keeps a note saying why, so it can be counted and explained.
    error: errText ?? backupNote,
    cost_usd: Number(costUsd.toFixed(6)), tokens_in: tokensIn, tokens_out: tokensOut,
    latency_ms: Date.now() - started,
  });

  return new Response(JSON.stringify({
    ok, agent: agentId, codename: agent.codename, model: modelUsed,
    provider: backupNote ? "openai" : "anthropic",
    output: out, error: errText,
    cost_usd: Number(costUsd.toFixed(6)), tokens: { in: tokensIn, out: tokensOut },
    latency_ms: Date.now() - started,
  }), { status: ok ? 200 : 422, headers: { "content-type": "application/json" } });
});
