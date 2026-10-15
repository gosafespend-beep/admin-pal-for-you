import { describe, expect, it } from "vitest";
import {
  buildOpenAiRequest, classifyAnthropicFailure, DEFAULT_OPENAI_MODEL, fallbackAllowed, fallbackNote, openAiCost,
  parseFallbackKind, parseOpenAiResponse, pickOpenAiModel, readFallbackEnv, skippedAgents,
} from "./aiFallback";

const CREDIT_BODY = '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}';

describe("classifyAnthropicFailure", () => {
  it("falls back when the provider is the problem", () => {
    expect(classifyAnthropicFailure(400, CREDIT_BODY)).toEqual({ fallback: true, kind: "credits" });
    expect(classifyAnthropicFailure(402, "")).toEqual({ fallback: true, kind: "credits" });
    expect(classifyAnthropicFailure(401, "invalid x-api-key")).toEqual({ fallback: true, kind: "auth" });
    expect(classifyAnthropicFailure(403, "")).toEqual({ fallback: true, kind: "auth" });
    expect(classifyAnthropicFailure(429, "rate limited")).toEqual({ fallback: true, kind: "rate_limit" });
    expect(classifyAnthropicFailure(529, "")).toEqual({ fallback: true, kind: "overloaded" });
    expect(classifyAnthropicFailure(500, "")).toEqual({ fallback: true, kind: "server" });
    expect(classifyAnthropicFailure(503, "")).toEqual({ fallback: true, kind: "server" });
    expect(classifyAnthropicFailure(null)).toEqual({ fallback: true, kind: "network" });
  });

  it("does not hide our own mistakes behind a second provider", () => {
    expect(classifyAnthropicFailure(400, '{"error":{"message":"max_tokens: must be greater than 0"}}')).toEqual({ fallback: false, kind: "request" });
    expect(classifyAnthropicFailure(404, "model not found")).toEqual({ fallback: false, kind: "request" });
    expect(classifyAnthropicFailure(422, "")).toEqual({ fallback: false, kind: "request" });
  });
});

describe("the note that marks a backup run", () => {
  it("round-trips, and ignores anything else", () => {
    for (const k of ["credits", "auth", "rate_limit", "overloaded", "server", "network"] as const) {
      expect(parseFallbackKind(fallbackNote(k))).toBe(k);
    }
    expect(parseFallbackKind("contract violation: /x is required")).toBeNull();
    expect(parseFallbackKind("fallback: anthropic nonsense")).toBeNull();
    expect(parseFallbackKind(null)).toBeNull();
  });
});

describe("configuration", () => {
  const env = (o: Record<string, string>) => readFallbackEnv((n) => o[n]);

  it("keeps the compliance reviewers on Anthropic only, unless told otherwise", () => {
    const e = env({ OPENAI_API_KEY: "k" });
    expect([...skippedAgents(e)].sort()).toEqual(["S13", "S13H"]);
    expect(fallbackAllowed(e, "S4C")).toBe(true);
    expect(fallbackAllowed(e, "S13")).toBe(false);
    expect(fallbackAllowed(e, "S13H")).toBe(false);
    expect(fallbackAllowed(env({ OPENAI_API_KEY: "k", AI_FALLBACK_SKIP_AGENTS: "" }), "S13")).toBe(true);
    expect(fallbackAllowed(env({ OPENAI_API_KEY: "k", AI_FALLBACK_SKIP_AGENTS: "S4C, S4V" }), "S4V")).toBe(false);
  });

  it("does nothing without a key", () => {
    expect(fallbackAllowed(env({}), "S4C")).toBe(false);
    expect(fallbackAllowed(env({ OPENAI_API_KEY: "   " }), "S4C")).toBe(false);
  });

  it("chooses a model by Anthropic tier", () => {
    expect(pickOpenAiModel("claude-sonnet-5", env({}))).toBe(DEFAULT_OPENAI_MODEL);
    expect(pickOpenAiModel("claude-sonnet-5", env({ OPENAI_MODEL: "m1" }))).toBe("m1");
    expect(pickOpenAiModel("claude-opus-4-8", env({ OPENAI_MODEL: "m1" }))).toBe("m1");
    expect(pickOpenAiModel("claude-opus-4-8", env({ OPENAI_MODEL: "m1", OPENAI_MODEL_STRONG: "big" }))).toBe("big");
    expect(pickOpenAiModel("claude-haiku-4-5-20251001", env({ OPENAI_MODEL: "m1", OPENAI_MODEL_STRONG: "big" }))).toBe("m1");
  });
});

describe("buildOpenAiRequest", () => {
  const base = { model: "m", system: "SYS", user: "USR", maxTokens: 8000 };

  it("sends the same system and user text and asks for JSON when the answer is an object", () => {
    const r = buildOpenAiRequest({ ...base, json: true });
    expect(r.messages).toEqual([{ role: "system", content: "SYS" }, { role: "user", content: "USR" }]);
    expect(r.response_format).toEqual({ type: "json_object" });
  });

  it("does not force JSON mode when the answer is an array", () => {
    expect("response_format" in buildOpenAiRequest({ ...base, json: false })).toBe(false);
  });

  it("leaves room for hidden reasoning, up to a ceiling", () => {
    expect(buildOpenAiRequest({ ...base, json: true }).max_completion_tokens).toBe(16_000);
    expect(buildOpenAiRequest({ ...base, maxTokens: 2000, json: true }).max_completion_tokens).toBe(4000);
    expect(buildOpenAiRequest({ ...base, maxTokens: 1, json: true }).max_completion_tokens).toBe(512);
  });
});

describe("parseOpenAiResponse", () => {
  it("reads the text and the token counts", () => {
    const r = parseOpenAiResponse({ choices: [{ message: { content: '{"a":1}' }, finish_reason: "stop" }], usage: { prompt_tokens: 120, completion_tokens: 30 } });
    expect(r).toEqual({ text: '{"a":1}', tokensIn: 120, tokensOut: 30 });
  });

  it("refuses to pass on a half-finished or empty answer", () => {
    expect(() => parseOpenAiResponse({ choices: [{ message: { content: '{"a":' }, finish_reason: "length" }] })).toThrow(/ran out of room/);
    expect(() => parseOpenAiResponse({ choices: [{ message: { content: "" }, finish_reason: "stop" }] })).toThrow(/no text/);
    expect(() => parseOpenAiResponse({ choices: [{ message: { content: null, refusal: "I can't help with that" } }] })).toThrow(/refused/);
    expect(() => parseOpenAiResponse({})).toThrow(/no text/);
  });
});

describe("openAiCost", () => {
  it("uses the estimate unless overridden", () => {
    expect(openAiCost(1_000_000, 1_000_000, readFallbackEnv(() => undefined))).toBeCloseTo(0.75 + 4.5, 6);
    expect(openAiCost(2_000_000, 1_000_000, readFallbackEnv((n) => ({ OPENAI_PRICE_IN: "1", OPENAI_PRICE_OUT: "2" } as Record<string, string>)[n]))).toBeCloseTo(4, 6);
    expect(openAiCost(1_000_000, 0, readFallbackEnv((n) => ({ OPENAI_PRICE_IN: "oops" } as Record<string, string>)[n]))).toBeCloseTo(0.75, 6);
  });
});
