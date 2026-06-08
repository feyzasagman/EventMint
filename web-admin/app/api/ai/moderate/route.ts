// app/api/ai/moderate/route.ts
import { NextResponse } from "next/server";
import { cacheGet, cacheKeyFrom, cacheSet, rateLimit } from "../../_lib/limits";
import {
  extractJsonObject,
  getOpenAiApiKey,
  openAiChat,
} from "../../_lib/openai";
import { moderateFallback, shouldUseAiFallback, type ModerationResult } from "../../../../lib/aiFallbacks";

const RISK_LEVELS = ["low", "medium", "high"] as const;
type RiskLevel = (typeof RISK_LEVELS)[number];

function validateModeration(parsed: Record<string, unknown>): ModerationResult | null {
  const ok = Boolean(parsed.ok);
  const risk = String(parsed.risk ?? "").trim() as RiskLevel;
  if (!RISK_LEVELS.includes(risk)) return null;

  const reason = String(parsed.reason ?? "").trim().slice(0, 200);
  if (!reason) return null;

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];

  if (!ok && risk !== "high") {
    return { ok: false, risk: "high", reason, suggestions };
  }

  if (ok && risk === "high") {
    return { ok: true, risk: "medium", reason, suggestions };
  }

  return { ok, risk, reason, suggestions };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(ip, "moderate");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit. Lütfen biraz bekleyin." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  const language = String(body.language ?? "tr").trim();

  if (!text) {
    return NextResponse.json({ error: "text zorunlu" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "metin çok uzun" }, { status: 400 });
  }

  if (!getOpenAiApiKey()) {
    const fallback = moderateFallback(text);
    return NextResponse.json({ ...fallback, fallback: true, warning: "OPENAI_API_KEY tanımlı değil." });
  }

  const ck = cacheKeyFrom({ route: "moderate", text, language });
  const cached = cacheGet(ck);
  if (cached) {
    return NextResponse.json({ ...(cached as ModerationResult), cached: true });
  }

  const prompt = `
Sen bir okul kulüp platformu içerik moderasyon asistanısın. Sadece GEÇERLİ JSON döndür.
Dil: ${language}

İncelenecek metin:
${JSON.stringify(text)}

İstenen JSON şeması:
{
  "ok": boolean,
  "risk": "low" | "medium" | "high",
  "reason": string,
  "suggestions": string[]
}

Kurallar:
- JSON dışında hiçbir şey yazma.
- reason en fazla 200 karakter.
- suggestions en fazla 5 madde (ok=false iken de öneri verebilirsin).
- Küfür, nefret söylemi, şiddet teşviki, kişisel veri (telefon, adres, TCKN vb.), tehdit veya taciz varsa: ok=false, risk="high".
- Sadece küçük üslup/noktalama/netlik sorunları varsa: ok=true, risk="low" veya "medium" ve suggestions ile düzeltme öner.
- risk="high" ise ok mutlaka false olmalı.
`.trim();

  const out = await openAiChat(prompt, { maxOutputTokens: 150, temperature: 0.1 });
  if (!out.ok) {
    if (shouldUseAiFallback(out.status)) {
      const fallback = moderateFallback(text);
      return NextResponse.json({
        ...fallback,
        fallback: true,
        warning: out.message,
      });
    }
    return NextResponse.json(
      { error: out.message },
      { status: out.status >= 400 && out.status < 600 ? out.status : 500 }
    );
  }

  const parsed = extractJsonObject(out.text);
  if (!parsed) {
    return NextResponse.json(
      { error: "Model JSON döndürmedi", detail: out.text.slice(0, 200) },
      { status: 500 }
    );
  }

  const result = validateModeration(parsed);
  if (!result) {
    return NextResponse.json(
      { error: "Geçersiz moderasyon yanıtı", detail: out.text.slice(0, 200) },
      { status: 500 }
    );
  }

  cacheSet(ck, result);
  return NextResponse.json(result);
}
