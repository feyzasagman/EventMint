import { NextResponse } from "next/server";
import {
  extractJsonObject,
  getOpenAiApiKey,
  getOpenAiModel,
  openAiChat,
} from "../../_lib/openai";

type SuggestInput = {
  title: string;
  description: string;
  location: string;
  category: string;
};

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of raw) {
    const tag = String(item).trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags.slice(0, 8);
}

function fallbackFromText(title: string, description: string) {
  const text = `${title} ${description}`.toLocaleLowerCase("tr-TR");
  const words = text
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);

  const stop = new Set(["ve", "ile", "için", "bir", "bu", "olan", "etkinlik", "kulüp"]);
  const freq = new Map<string, number>();
  for (const word of words) {
    if (stop.has(word)) continue;
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  const tags = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return {
    category: "Genel",
    tags: tags.length > 0 ? tags : ["etkinlik", "kampüs", "öğrenci"],
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const input: SuggestInput = {
    title: String(body.title ?? "").trim(),
    description: String(body.description ?? "").trim(),
    location: String(body.location ?? "").trim(),
    category: String(body.category ?? "").trim(),
  };

  if (!getOpenAiApiKey()) {
    const fallback = fallbackFromText(input.title, input.description);
    return NextResponse.json({ ok: true, data: fallback, fallback: true });
  }

  if (!input.title && !input.description) {
    return NextResponse.json({ ok: false, error: "title veya description gerekli." }, { status: 400 });
  }

  const prompt = `Sadece JSON döndür.
title: ${JSON.stringify(input.title)}
description: ${JSON.stringify(input.description)}
location: ${JSON.stringify(input.location)}
category: ${JSON.stringify(input.category)}
Şema: {"category":"...","tags":["tag1","tag2"]}
tags: 3-6 adet, küçük harf.`;

  try {
    const ai = await openAiChat(prompt, { maxOutputTokens: 150 });

    if (!ai.ok) {
      const fallback = fallbackFromText(input.title, input.description);
      return NextResponse.json({
        ok: true,
        data: fallback,
        fallback: true,
        warning: ai.message,
      });
    }

    const parsed = extractJsonObject(ai.text);
    if (!parsed) {
      const fallback = fallbackFromText(input.title, input.description);
      return NextResponse.json({ ok: true, data: fallback, fallback: true });
    }

    const category = String(parsed.category ?? "").trim() || "Genel";
    let tags = normalizeTags(parsed.tags);
    if (tags.length < 3) {
      const fallback = fallbackFromText(input.title, input.description);
      tags = [...new Set([...tags, ...fallback.tags])].slice(0, 8);
    }

    return NextResponse.json({
      ok: true,
      data: { category, tags },
      model: ai.model || getOpenAiModel(),
    });
  } catch (error) {
    console.error("suggest-tags route error:", error);
    const fallback = fallbackFromText(input.title, input.description);
    return NextResponse.json({ ok: true, data: fallback, fallback: true });
  }
}
