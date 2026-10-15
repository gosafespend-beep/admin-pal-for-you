# OpenAI backup for the marketing AI

Anthropic stays the primary. If it fails for a reason outside our control, the same request is sent to OpenAI so the
marketing pipeline keeps moving. Code: `supabase/functions/_shared/aiFallback.ts`, used by `agent-run` (every agent)
and `generate-topics`.

## When the backup is used

| Anthropic answer | Backup? |
|---|---|
| Credit balance too low (400 with that message, or 402) | yes |
| Key rejected (401, 403) | yes |
| Rate limited (429), overloaded (529), server error (5xx), no answer at all | yes |
| Any other 400/404/422 (our request was wrong) | **no**: that is a bug to fix, not to hide |

## Setting it up

Add these as **Edge Function secrets** in the Supabase project (Edge Functions, Secrets). Nothing changes until the key exists.

| Secret | Required | Meaning |
|---|---|---|
| `OPENAI_API_KEY` | yes | Turns the backup on. |
| `OPENAI_MODEL` | recommended | The model to use. If unset it uses a built-in default (`gpt-5.4-mini`), which is a best guess and may not exist on your account. |
| `OPENAI_MODEL_STRONG` | no | Used instead of `OPENAI_MODEL` for agents that normally run on Anthropic's strongest tier (Opus). |
| `AI_FALLBACK_SKIP_AGENTS` | no | Comma-separated agent ids that must never use the backup. Default `S13,S13H`: the compliance reviewers. Set it to an empty value to let them fall back too. |
| `OPENAI_PRICE_IN`, `OPENAI_PRICE_OUT` | no | Dollars per million tokens, used only for the daily spend caps. Default 0.75 and 4.5 (an estimate). |

## What you will see

- Runs that used the backup are logged in `sgs_action_log` with the model `openai:<model>` and the note
  `fallback: anthropic credits` (or `auth`, `rate_limit`, `overloaded`, `server`, `network`).
- The monitor raises a **warning**, "Anthropic is out of credit: marketing is running on the OpenAI backup", while it keeps
  happening, and emails it like any other alert. The backup hides the outage from the posting schedule, so it must not hide
  the cause.
- If the backup fails too, the error shows both messages, starting with Anthropic's, so the existing "credit balance too low"
  problem alert still fires.

## Compliance

`S13` and `S13H` (the compliance reviewers) do not fall back by default. If Anthropic is unavailable they fail, and the
pipeline holds the post for human review instead of letting a different model approve it. A held post is never posted.

## Trade-offs to know about

- Writing quality and tone will differ from the Anthropic models the prompts were tuned on. Read the first few backup posts.
- Costs are estimates unless `OPENAI_PRICE_*` are set to your real rates.
- Reasoning models spend hidden tokens against `max_completion_tokens`; the request allows twice the agent's output limit
  (up to 16,000). A run that still runs out is reported as an error, never saved half-finished.
