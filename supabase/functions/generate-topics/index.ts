// Topic generator - keeps the carousel pipeline from running dry, grounded in GSC demand.
// Secrets: AGENT_RUN_SECRET, ANTHROPIC_API_KEY (optional backup: OPENAI_API_KEY, see ../_shared/aiFallback.ts)
//
// This function was deployed from outside this repository. The only change made here is the OpenAI backup.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  buildOpenAiRequest, callOpenAI, classifyAnthropicFailure, fallbackAllowed, pickOpenAiModel, readFallbackEnv,
} from "../_shared/aiFallback.ts";

const ANTHROPIC = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-5";
const THRESHOLD = 6; const BATCH = 12;

class AnthropicError extends Error {
  constructor(public status: number, public body: string) { super("anthropic " + status + ": " + body.slice(0, 200)); }
}

async function askAnthropic(key: string, prompt: string): Promise<string> {
  const r = await fetch(ANTHROPIC, { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 2000, messages: [{ role: "user", content: prompt }] }) });
  if (!r.ok) throw new AnthropicError(r.status, await r.text());
  const data = await r.json();
  return (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
}

Deno.serve(async (req: Request): Promise<Response> => {
  const secret = Deno.env.get("AGENT_RUN_SECRET") ?? "";
  if (!secret || (req.headers.get("Authorization") ?? "") !== secret) return new Response("unauthorized", { status: 401 });
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (!key) return new Response(JSON.stringify({ ok: false, error: "no anthropic key" }), { status: 500 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { count: remaining } = await supabase.from("sgs_topic_backlog").select("*", { count: "exact", head: true }).is("used_at", null);
  const force = (await req.json().catch(() => ({})))?.force === true;
  if ((remaining ?? 0) >= THRESHOLD && !force) return new Response(JSON.stringify({ ok: true, skipped: true, remaining }), { status: 200, headers: { "content-type": "application/json" } });

  const { data: gsc } = await supabase.from("gsc_performance").select("query, impressions").eq("dimension_type", "query").not("query", "eq", "").order("impressions", { ascending: false }).limit(40);
  const searchTerms = [...new Set((gsc ?? []).map((r: any) => r.query))].filter((q) => !/go ?safe ?spend|gosafespend/i.test(q)).slice(0, 20);
  const { data: existing } = await supabase.from("sgs_topic_backlog").select("topic").limit(200);
  const used = (existing ?? []).map((r: any) => r.topic);

  const prompt = `You write Instagram carousel topics for Go Safe Spend, a personal budgeting and money-management app.\n\nGood topics are specific money-struggle moments or money habits a stressed, money-anxious person would stop scrolling for - overspending, debt, saving on a low income, budgeting that actually sticks, money anxiety. Blunt, a little funny, concrete. Not generic ("budgeting tips") and not salesy.\n\nReal search terms we're seeing (inspiration, don't just copy):\n${searchTerms.length ? searchTerms.join(", ") : "(no search data yet)"}\n\nAlready used - do NOT repeat these or close paraphrases:\n${used.slice(0, 60).join(" | ")}\n\nReturn ONLY a JSON array of ${BATCH} objects: [{"topic":"...","angle":"...","priority":10-40}]. Lower priority number = post sooner. No prose, no code fences.`;

  try {
    let text: string;
    let provider = "anthropic";
    try {
      text = await askAnthropic(key, prompt);
    } catch (primary) {
      const verdict = primary instanceof AnthropicError ? classifyAnthropicFailure(primary.status, primary.body) : classifyAnthropicFailure(null);
      const env = readFallbackEnv((n) => Deno.env.get(n));
      if (!verdict.fallback || !fallbackAllowed(env, "generate-topics")) throw primary;
      try {
        // The answer is an array, so JSON-object mode is off; the extraction below finds the array in the text.
        const r = await callOpenAI(env.OPENAI_API_KEY!, buildOpenAiRequest({ model: pickOpenAiModel(ANTHROPIC_MODEL, env), system: "You follow output instructions exactly.", user: prompt, maxTokens: 2000, json: false }));
        text = r.text;
        provider = "openai";
      } catch (backup) {
        throw new Error((primary as Error).message + " | backup (openai) also failed: " + (backup instanceof Error ? backup.message : String(backup)));
      }
    }
    const start = text.indexOf("["); const end = text.lastIndexOf("]");
    const topics = JSON.parse(text.slice(start, end + 1));
    let added = 0;
    for (const t of topics) {
      if (!t?.topic) continue;
      const { error } = await supabase.from("sgs_topic_backlog").insert({ topic: String(t.topic).slice(0, 200), angle: t.angle ?? null, priority: Number(t.priority) || 30, created_by: "generator" });
      if (!error) added++;
    }
    return new Response(JSON.stringify({ ok: true, provider, remaining_before: remaining, added, grounded_in_search_terms: searchTerms.length }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
