# Reading the app controls from the apps

The admin panel's **App controls** page sets three things the apps can read at start-up:

- a **message** (a banner, or a full maintenance screen),
- the **newest** and **oldest allowed** version per store,
- **feature flags**, with gradual rollout.

Nothing here affects anyone until an app release calls the endpoint below. Until then the page is safe to set up.

## The call

```
GET https://qeogqvjqvafbzufanwki.supabase.co/functions/v1/app-config?platform=ios&v=1.4.0&id=<stable id>
```

| Parameter | Meaning |
|-----------|---------|
| `platform` | `ios`, `android` or `web` (required) |
| `v` | the app's own version, such as `1.4.0` (store apps; needed for update checks) |
| `id` | a stable, anonymous id for this install or person, up to 64 characters of letters, numbers and `_ . : -` (needed for percentage rollouts) |

No sign-in and no API key. Any origin may call it. It reads and returns settings only.

Response:

```json
{
  "banner": { "kind": "banner" | "maintenance", "severity": "info" | "warning" | "critical", "message": "..." } | null,
  "update": { "required": false, "available": true, "latest": "1.4.0", "min": "1.2.0", "storeUrl": "https://..." } | null,
  "flags": { "new_budget_screen": true },
  "generatedAt": "2026-10-10T12:00:00.000Z"
}
```

`update` is `null` on the web. `flags` contains only flags marked public, already worked out for this platform and id.

## What the app must do

1. **Fail open.** If the call fails, times out (use about 3 seconds) or returns something unexpected, carry on as if nothing were set. The service being down must never block anyone.
2. **Show the banner** when `banner` is not null. If `kind` is `maintenance`, show a full-screen message and nothing else.
3. **Handle updates.** If `update.required` is true, show a blocking "Update to continue" screen that opens `update.storeUrl`. If only `update.available` is true, show a dismissible prompt.
4. **Use flags with a safe default.** Read `flags[key] === true`; treat a missing key as off.
5. **Cache briefly.** Reuse the answer for about a minute, and keep the last good answer on disk for when the app starts offline.
6. **Send the version with analytics events.** Add `app_version` (for example `"1.4.0"`) to each event's properties. The panel uses it to show how many people are on each version, which tells you how many a forced update would reach. Until apps send it, that list is empty.

## Example (React Native / web)

```ts
const BASE = "https://qeogqvjqvafbzufanwki.supabase.co/functions/v1/app-config";

export async function loadAppConfig(platform: "ios" | "android" | "web", version: string, id: string) {
  try {
    const res = await fetch(`${BASE}?platform=${platform}&v=${encodeURIComponent(version)}&id=${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;          // fail open
    return await res.json();
  } catch {
    return null;                       // fail open
  }
}
```

## Rules the panel enforces for you

- An "oldest allowed" version cannot be newer than the "newest in the store", so you cannot force an update to a version nobody can download.
- Raising the oldest allowed version, and switching on a maintenance screen, each need a typed reason and an explicit confirmation, and are written to the audit log.
- An app that does not send its version is never told an update is required.
