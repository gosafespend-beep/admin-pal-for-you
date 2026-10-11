/**
 * The product control plane: what the apps are told at start-up.
 *
 *   banner       a message on every screen, or a full "down for maintenance" screen
 *   versions     the newest version in each store, and the oldest one still allowed
 *   flags        features that can be switched on or off, or rolled out to a share of people
 *
 * Pure, so every decision is unit-tested and the admin page can show exactly
 * what an app would be told. The public endpoint (app-config) and the admin
 * page both use this file, so they cannot disagree.
 *
 * Principle: apps must FAIL OPEN. If this service cannot be reached, the app
 * carries on as normal. Nothing here can lock people out of the app by being
 * down; only an explicit minimum version set by an admin can.
 */

export const PLATFORMS = ["ios", "android", "web"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const STORE_PLATFORMS = ["ios", "android"] as const;
export type StorePlatform = (typeof STORE_PLATFORMS)[number];

export type BannerKind = "banner" | "maintenance";
export type BannerSeverity = "info" | "warning" | "critical";

export interface Control {
  banner_active: boolean;
  banner_kind: BannerKind;
  banner_severity: BannerSeverity;
  banner_message: string;
  banner_starts_at: string | null;
  banner_ends_at: string | null;
  ios_latest: string | null;
  ios_min: string | null;
  ios_store_url: string | null;
  android_latest: string | null;
  android_min: string | null;
  android_store_url: string | null;
}

export interface Flag {
  key: string;
  description: string;
  enabled: boolean;
  rollout_pct: number;
  platforms: Platform[];
  public: boolean;
}

// ---- versions ------------------------------------------------------------------------------

const STORED_VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/** "1.4.2" -> [1,4,2]. Stored versions need all three parts; a client may send "1.4" and is read as 1.4.0. */
export function parseVersion(v: unknown, strict = false): [number, number, number] | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (strict ? !STORED_VERSION.test(s) : !/^\d{1,3}(\.\d{1,3}){0,2}$/.test(s)) return null;
  const [a, b = "0", c = "0"] = s.split(".");
  return [Number(a), Number(b), Number(c)];
}

/** Negative if a is older than b, 0 if equal, positive if newer. Null when either is not a version. */
export function compareVersions(a: unknown, b: unknown): number | null {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

export interface VersionsInput {
  platform?: unknown;
  latest?: unknown;
  min?: unknown;
  storeUrl?: unknown;
}
export type VersionsResult =
  | { ok: true; value: { platform: StorePlatform; latest: string | null; min: string | null; storeUrl: string | null } }
  | { ok: false; error: string };

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

export function validateVersions(input: VersionsInput): VersionsResult {
  if (!STORE_PLATFORMS.includes(input.platform as StorePlatform)) return { ok: false, error: "Choose iOS or Android" };
  const platform = input.platform as StorePlatform;
  const norm = (v: unknown, label: string): string | null | Error => {
    if (blank(v)) return null;
    return parseVersion(v, true) ? (v as string).trim() : new Error(`${label} must look like 1.4.2`);
  };
  const latest = norm(input.latest, "The newest version");
  if (latest instanceof Error) return { ok: false, error: latest.message };
  const min = norm(input.min, "The oldest allowed version");
  if (min instanceof Error) return { ok: false, error: min.message };
  if (min && !latest) return { ok: false, error: "Enter the newest version in the store before setting an oldest allowed version" };
  // The guard that stops an admin from forcing an update to a version nobody can download yet.
  if (min && latest && (compareVersions(min, latest) ?? 0) > 0) return { ok: false, error: "The oldest allowed version can't be newer than the newest version in the store" };

  let storeUrl: string | null = null;
  if (!blank(input.storeUrl)) {
    const u = String(input.storeUrl).trim();
    if (!/^https:\/\/[^\s]+$/.test(u) || u.length > 300) return { ok: false, error: "The store link must be a full https:// address" };
    storeUrl = u;
  }
  return { ok: true, value: { platform, latest, min, storeUrl } };
}

// ---- banner ----------------------------------------------------------------------------------

export interface BannerInput {
  active?: unknown;
  kind?: unknown;
  severity?: unknown;
  message?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
}
export type BannerResult =
  | { ok: true; value: { active: boolean; kind: BannerKind; severity: BannerSeverity; message: string; startsAt: string | null; endsAt: string | null } }
  | { ok: false; error: string };

export function validateBanner(input: BannerInput): BannerResult {
  if (typeof input.active !== "boolean") return { ok: false, error: "Say whether the message is on" };
  const kind = input.kind ?? "banner";
  if (kind !== "banner" && kind !== "maintenance") return { ok: false, error: "Choose a banner or a maintenance screen" };
  const severity = input.severity ?? "info";
  if (severity !== "info" && severity !== "warning" && severity !== "critical") return { ok: false, error: "Choose info, warning or critical" };
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (message.length > 280) return { ok: false, error: "Keep the message under 280 characters" };
  if (input.active && message.length < 5) return { ok: false, error: "Write the message people will see" };

  const when = (v: unknown, label: string): string | null | Error => {
    if (blank(v)) return null;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? new Error(`${label} isn't a valid date and time`) : d.toISOString();
  };
  const startsAt = when(input.startsAt, "The start");
  if (startsAt instanceof Error) return { ok: false, error: startsAt.message };
  const endsAt = when(input.endsAt, "The end");
  if (endsAt instanceof Error) return { ok: false, error: endsAt.message };
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return { ok: false, error: "The end must be after the start" };
  return { ok: true, value: { active: input.active, kind, severity, message, startsAt, endsAt } };
}

export function bannerIsLive(c: Pick<Control, "banner_active" | "banner_starts_at" | "banner_ends_at">, now: Date = new Date()): boolean {
  if (!c.banner_active) return false;
  if (c.banner_starts_at && now < new Date(c.banner_starts_at)) return false;
  if (c.banner_ends_at && now >= new Date(c.banner_ends_at)) return false;
  return true;
}

// ---- flags -------------------------------------------------------------------------------------

export interface FlagInput {
  key?: unknown;
  description?: unknown;
  enabled?: unknown;
  rolloutPct?: unknown;
  platforms?: unknown;
  public?: unknown;
}
export type FlagResult = { ok: true; value: Flag } | { ok: false; error: string };

export function validateFlag(input: FlagInput): FlagResult {
  const key = typeof input.key === "string" ? input.key.trim() : "";
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(key)) return { ok: false, error: "The name must be 3 to 41 characters: lowercase letters, numbers and underscores, starting with a letter" };
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length < 3 || description.length > 200) return { ok: false, error: "Describe the flag in 3 to 200 characters" };
  if (typeof input.enabled !== "boolean") return { ok: false, error: "Say whether it is on" };
  const pct = typeof input.rolloutPct === "number" ? input.rolloutPct : Number(input.rolloutPct ?? 100);
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) return { ok: false, error: "The rollout must be a whole number from 0 to 100" };
  const platforms = Array.isArray(input.platforms) ? input.platforms : [...PLATFORMS];
  if (platforms.length === 0 || !platforms.every((p) => PLATFORMS.includes(p as Platform))) return { ok: false, error: "Choose at least one of iOS, Android and web" };
  const isPublic = input.public === undefined ? true : input.public;
  if (typeof isPublic !== "boolean") return { ok: false, error: "public must be true or false" };
  return { ok: true, value: { key, description, enabled: input.enabled, rollout_pct: pct, platforms: [...new Set(platforms as Platform[])], public: isPublic } };
}

/** A stable number from 0 to 99 for this flag and this person, so a 10% rollout is always the same 10%. */
export function flagBucket(key: string, id: string): number {
  let h = 0x811c9dc5;
  const s = `${key}:${id}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

export function evaluateFlag(flag: Flag, platform: Platform, id?: string | null): boolean {
  if (!flag.enabled || !flag.platforms.includes(platform)) return false;
  if (flag.rollout_pct >= 100) return true;
  if (flag.rollout_pct <= 0) return false;
  // A partial rollout needs a stable identity; without one nobody can be placed in the group.
  return !!id && flagBucket(flag.key, id) < flag.rollout_pct;
}

// ---- what an app is told ----------------------------------------------------------------------

export interface PublicConfig {
  banner: { kind: BannerKind; severity: BannerSeverity; message: string } | null;
  update: { required: boolean; available: boolean; latest: string | null; min: string | null; storeUrl: string | null } | null;
  flags: Record<string, boolean>;
  generatedAt: string;
}

export interface ClientInfo {
  platform: Platform;
  version?: string | null;
  id?: string | null;
}

export function buildPublicConfig(control: Control, flags: Flag[], client: ClientInfo, now: Date = new Date()): PublicConfig {
  const banner = bannerIsLive(control, now) && control.banner_message
    ? { kind: control.banner_kind, severity: control.banner_severity, message: control.banner_message }
    : null;

  let update: PublicConfig["update"] = null;
  if (client.platform !== "web") {
    const latest = control[`${client.platform}_latest`];
    const min = control[`${client.platform}_min`];
    const storeUrl = control[`${client.platform}_store_url`];
    // Only decide "required" when the app told us a version we can read. An app that sends nothing is never forced.
    const behindMin = min && client.version ? (compareVersions(client.version, min) ?? 0) < 0 : false;
    const behindLatest = latest && client.version ? (compareVersions(client.version, latest) ?? 0) < 0 : false;
    update = { required: behindMin, available: behindLatest, latest, min, storeUrl };
  }

  const out: Record<string, boolean> = {};
  for (const f of flags) if (f.public) out[f.key] = evaluateFlag(f, client.platform, client.id);
  return { banner, update, flags: out, generatedAt: now.toISOString() };
}

export function parseClientInfo(params: URLSearchParams): ClientInfo | null {
  const platform = params.get("platform");
  if (!PLATFORMS.includes(platform as Platform)) return null;
  const v = params.get("v");
  const id = params.get("id");
  return {
    platform: platform as Platform,
    version: v && parseVersion(v) ? v : null,
    id: id && /^[A-Za-z0-9_.:-]{1,64}$/.test(id) ? id : null,
  };
}
