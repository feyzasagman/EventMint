// app/api/_lib/gemini.ts
import crypto from "crypto";

type JsonResult = { ok: true; data: any } | { ok: false; status: number; error: string };

const MODEL_LIST_TTL_MS = 1000 * 60 * 60; // 1h
let cachedModels: { at: number; names: string[] } | null = null;

export function hashKey(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function listModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (cachedModels && now - cachedModels.at < MODEL_LIST_TTL_MS) return cachedModels.names;

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ListModels failed: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const models: any[] = json?.models ?? [];
  const names = models
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => String(m.name || "").replace(/^models\//, "")) // normalize to "gemini-..."
    .filter(Boolean);

  cachedModels = { at: now, names };
  return names;
}

const PREFERRED_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
  "gemini-1.5-pro-latest",
] as const;

export const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

export function pickModel(names: string[]) {
  for (const preferred of PREFERRED_MODELS) {
    if (names.includes(preferred)) return preferred;
  }
  return names[0] || DEFAULT_GEMINI_MODEL;
}

export async function resolveGeminiModel(apiKey: string): Promise<string> {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  if (fromEnv) return fromEnv;
  const models = await listModels(apiKey);
  return pickModel(models);
}

export function stripJsonFences(text: string) {
  return text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function geminiGenerateJson(
  apiKey: string,
  model: string,
  prompt: string,
  maxOutputTokens = 350,
  temperature = 0.2
): Promise<JsonResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: raw.slice(0, 400) };
  }

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, status: 500, error: "Invalid upstream JSON" };
  }

  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("")?.trim() || "";

  return { ok: true, data: text };
}
