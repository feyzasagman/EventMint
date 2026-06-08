import { stripJsonFences } from "./gemini";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_MAX_OUTPUT_TOKENS = 150;
const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;

export function getOpenAiApiKey(): string | undefined {
  const key = process.env.OPENAI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  return key || undefined;
}

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

function modelCandidates(): string[] {
  const preferred = getOpenAiModel();
  return [...new Set([preferred, ...FALLBACK_MODELS])];
}

function usesCompletionTokensParam(model: string): boolean {
  return /^gpt-5|^o\d/i.test(model);
}

function buildChatBody(
  model: string,
  prompt: string,
  maxOutputTokens: number,
  temperature: number
) {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
  };

  if (usesCompletionTokensParam(model)) {
    body.max_completion_tokens = maxOutputTokens;
  } else {
    body.max_tokens = maxOutputTokens;
    body.temperature = temperature;
  }

  return body;
}

function parseOpenAiError(status: number, detail: string): string {
  try {
    const json = JSON.parse(detail) as {
      error?: { message?: string; code?: string; type?: string };
    };
    const msg = json.error?.message?.trim();
    const code = json.error?.code ?? json.error?.type ?? "";

    if (status === 429) {
      if (code === "insufficient_quota" || msg?.toLowerCase().includes("quota")) {
        return "OpenAI kotası/bakiye bitti. platform.openai.com → Billing kontrol edin.";
      }
      if (code === "rate_limit_exceeded") {
        return "OpenAI hız limiti. 15 sn bekleyip tekrar deneyin.";
      }
      return "AI yoğun/kota. 30 sn sonra tekrar deneyin.";
    }

    if (msg) {
      if (status === 400) return `Geçersiz istek (400): ${msg}`;
      if (status === 404) return `Model bulunamadı (404): ${msg}`;
      return msg;
    }
  } catch {
    // ignore
  }
  return openAiErrorMessage(status);
}

export function openAiErrorMessage(status: number): string {
  switch (status) {
    case 401:
      return "API anahtarı geçersiz (401).";
    case 403:
      return "API erişimi reddedildi (403).";
    case 404:
      return "Model bulunamadı (404).";
    case 429:
      return "AI yoğun/kota. 30 sn sonra tekrar deneyin.";
    case 400:
      return "Geçersiz AI isteği (400). Model veya parametre hatası.";
    default:
      return status >= 500
        ? "AI sunucusu hatası. Daha sonra tekrar deneyin."
        : `AI çağrısı başarısız (${status}).`;
  }
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = stripJsonFences(text.trim());
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

type OpenAiChatResult =
  | { ok: true; model: string; text: string }
  | { ok: false; status: number; message: string };

async function callOpenAiOnce(
  model: string,
  prompt: string,
  maxOutputTokens: number,
  temperature: number
): Promise<OpenAiChatResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return { ok: false, status: 500, message: "Missing OPENAI_API_KEY" };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildChatBody(model, prompt, maxOutputTokens, temperature)),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("OpenAI error:", model, res.status, detail.slice(0, 400));
    return {
      ok: false,
      status: res.status,
      message: parseOpenAiError(res.status, detail),
    };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";

  if (!text) {
    return { ok: false, status: 500, message: "AI boş yanıt döndürdü." };
  }

  return { ok: true, model, text };
}

export async function openAiChat(
  prompt: string,
  options?: { maxOutputTokens?: number; temperature?: number }
): Promise<OpenAiChatResult> {
  const maxOutputTokens = options?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const temperature = options?.temperature ?? 0.2;

  const models = modelCandidates();
  let lastError: OpenAiChatResult = {
    ok: false,
    status: 500,
    message: "AI çağrısı başarısız.",
  };

  for (const model of models) {
    let result = await callOpenAiOnce(model, prompt, maxOutputTokens, temperature);

    if (!result.ok && result.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      result = await callOpenAiOnce(model, prompt, maxOutputTokens, temperature);
    }

    if (result.ok) return result;

    lastError = result;
    // Model/param hatasında sıradaki modele düş
    if (result.status === 400 || result.status === 404) continue;
    break;
  }

  return lastError;
}
