// app/api/_lib/limits.ts
import { hashKey } from "./gemini";

type CacheEntry = { at: number; value: any };
const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h
export const EVENT_AI_CACHE_TTL_MS = 1000 * 60 * 5; // 5m
const cache = new Map<string, CacheEntry>();

type Rate = { windowStart: number; count: number };
const rate = new Map<string, Rate>();
export const RATE_LIMIT_WINDOW_MS = 10_000; // 10s
const DEFAULT_MAX_REQ = 3;
export const EVENT_AI_MAX_REQ =
  process.env.NODE_ENV === "development" ? 30 : 8;

export function cacheGet(key: string, ttlMs = DEFAULT_CACHE_TTL_MS) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return e.value;
}

export function cacheSet(key: string, value: any) {
  cache.set(key, { at: Date.now(), value });
}

export function rateLimit(
  ip: string,
  routeName: string,
  maxReq = DEFAULT_MAX_REQ,
  windowMs = RATE_LIMIT_WINDOW_MS
) {
  if (process.env.NODE_ENV === "development" && process.env.AI_RATE_LIMIT !== "true") {
    return { ok: true as const };
  }

  const k = `${routeName}:${ip}`;
  const now = Date.now();
  const r = rate.get(k);
  if (!r || now - r.windowStart > windowMs) {
    rate.set(k, { windowStart: now, count: 1 });
    return { ok: true as const };
  }
  if (r.count >= maxReq) {
    return { ok: false as const, retryAfterMs: windowMs - (now - r.windowStart) };
  }
  r.count += 1;
  rate.set(k, r);
  return { ok: true as const };
}

export function cacheKeyFrom(input: object) {
  return hashKey(JSON.stringify(input));
}
