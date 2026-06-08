import { NextResponse } from "next/server";
import {
  cacheGet,
  cacheKeyFrom,
  cacheSet,
  EVENT_AI_CACHE_TTL_MS,
  EVENT_AI_MAX_REQ,
  rateLimit,
} from "../../_lib/limits";
import {
  extractJsonObject,
  getOpenAiApiKey,
  getOpenAiModel,
  openAiChat,
} from "../../_lib/openai";
import {
  buildImproveDescriptionPrompt,
  improveDescriptionAndTags,
  improveDescriptionFallback,
  normalizeEventTags,
  parseImproveDescriptionResponse,
} from "../../../../lib/eventAi";
import { shouldUseAiFallback } from "../../../../lib/aiFallbacks";

type EventAiAction = "fill" | "suggest_tags" | "improve_description";

type EventAiInput = {
  title: string;
  category: string;
  location: string;
  description: string;
  tags: string[];
};

type EventAiData = {
  title: string;
  category: string;
  location: string;
  description: string;
  tags: string[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function normalizeTags(value: unknown): string[] {
  return normalizeEventTags(value, 8);
}

function buildPrompt(action: EventAiAction, input: EventAiInput): string {
  const context = `
title: ${JSON.stringify(input.title)}
category: ${JSON.stringify(input.category)}
location: ${JSON.stringify(input.location)}
description: ${JSON.stringify(input.description)}
tags: ${JSON.stringify(input.tags)}`.trim();

  const schema = `{"title":"...","category":"...","location":"...","description":"...","tags":["..."]}`;

  if (action === "fill") {
    return `Okul kulüp etkinliği asistanı. Türkçe. Sadece JSON döndür.
${context}
Boş alanları doldur. tags: 3-5 kısa etiket.
${schema}`;
  }

  if (action === "suggest_tags") {
    return `Okul kulüp etkinliği asistanı. Türkçe. Sadece JSON döndür.
${context}
1 kategori + 3-5 etiket öner.
${schema}`;
  }

  return buildImproveDescriptionPrompt({
    title: input.title,
    category: input.category,
    location: input.location,
    description: input.description,
    existingTags: input.tags,
  });
}

function toEventData(
  action: EventAiAction,
  parsed: Record<string, unknown>,
  input: EventAiInput
): EventAiData {
  if (action === "improve_description") {
    const improved = parseImproveDescriptionResponse(parsed, input);
    return {
      title: input.title,
      category: input.category,
      location: input.location,
      description: improved.description,
      tags: improved.tags,
    };
  }

  return {
    title: String(parsed.title ?? input.title).trim(),
    category: String(parsed.category ?? input.category).trim(),
    location: String(parsed.location ?? input.location).trim(),
    description: String(parsed.description ?? input.description).trim(),
    tags: normalizeTags(parsed.tags).length > 0 ? normalizeTags(parsed.tags) : input.tags,
  };
}

function fallbackEventData(action: EventAiAction, input: EventAiInput): EventAiData {
  if (action === "improve_description") {
    const improved = improveDescriptionFallback(input);
    return {
      title: input.title,
      category: input.category,
      location: input.location,
      description: improved.description,
      tags: improved.tags,
    };
  }

  const text = `${input.title} ${input.description}`.toLocaleLowerCase("tr-TR");
  const words = text
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const tags = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  let category = input.category || "Genel";
  if (!input.category) {
    if (text.includes("python") || text.includes("yazılım")) category = "STEM";
    else if (text.includes("spor") || text.includes("turnuva")) category = "Spor";
    else if (text.includes("tiyatro") || text.includes("konser")) category = "Sanat";
  }

  const description =
    input.description || (input.title ? `${input.title} etkinliğine davetlisiniz.` : "");

  return {
    title: input.title || "Kampüs Etkinliği",
    category,
    location: input.location || "Kampüs",
    description,
    tags: tags.length > 0 ? tags : ["etkinlik", "kampüs", "öğrenci"],
  };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(ip, "event-ai", EVENT_AI_MAX_REQ);
  if (!rl.ok) {
    const waitSec = Math.ceil((rl.retryAfterMs ?? 10_000) / 1000);
    return jsonResponse(
      {
        ok: false,
        error: `Çok hızlı tıkladınız. ${waitSec} sn bekleyip tekrar deneyin.`,
        source: "server_rate_limit",
      },
      429
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "").trim() as EventAiAction;
  const input: EventAiInput = {
    title: String(body.title ?? "").trim(),
    category: String(body.category ?? "").trim(),
    location: String(body.location ?? "").trim(),
    description: String(body.description ?? "").trim(),
    tags: normalizeTags(body.tags),
  };

  if (!["fill", "suggest_tags", "improve_description"].includes(action)) {
    return jsonResponse({ ok: false, error: "Geçersiz action." }, 400);
  }

  if (!input.title && !input.description) {
    return jsonResponse({ ok: false, error: "title veya description gerekli." }, 400);
  }

  if (!getOpenAiApiKey()) {
    const fallback = fallbackEventData(action, input);
    return jsonResponse({
      ok: true,
      data: fallback,
      model: "fallback-local",
      fallback: true,
      warning: "OPENAI_API_KEY tanımlı değil.",
    });
  }

  const cacheKey = cacheKeyFrom({ route: "event-ai-openai", action, ...input });
  const cached = cacheGet(cacheKey, EVENT_AI_CACHE_TTL_MS) as
    | { data: EventAiData; model: string }
    | null;
  if (cached) {
    return jsonResponse({ ok: true, data: cached.data, model: cached.model, cached: true });
  }

  const ai = await openAiChat(buildPrompt(action, input), {
    maxOutputTokens: action === "improve_description" ? 320 : 150,
  });

  if (!ai.ok) {
    if (shouldUseAiFallback(ai.status)) {
      const fallback = fallbackEventData(action, input);
      return jsonResponse({
        ok: true,
        data: fallback,
        model: "fallback-local",
        fallback: true,
        warning: ai.message,
      });
    }
    return jsonResponse(
      { ok: false, error: ai.message },
      ai.status >= 400 && ai.status < 600 ? ai.status : 500
    );
  }

  const parsed = extractJsonObject(ai.text);
  if (!parsed) {
    if (action === "improve_description") {
      const fallback = improveDescriptionAndTags(input, ai.text);
      const data: EventAiData = {
        title: input.title,
        category: input.category,
        location: input.location,
        description: fallback.description,
        tags: fallback.tags,
      };
      return jsonResponse({
        ok: true,
        data,
        model: "fallback-local",
        fallback: true,
        warning: "Model JSON döndürmedi.",
      });
    }
    return jsonResponse(
      { ok: false, error: "Model JSON döndürmedi.", detail: ai.text.slice(0, 200) },
      500
    );
  }

  const data = toEventData(action, parsed, input);
  const model = ai.model || getOpenAiModel();

  cacheSet(cacheKey, { data, model });
  return jsonResponse({ ok: true, data, model });
}
