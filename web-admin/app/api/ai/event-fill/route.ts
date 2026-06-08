// app/api/ai/event-fill/route.ts
import { NextResponse } from "next/server";
import { cacheGet, cacheKeyFrom, cacheSet, rateLimit } from "../../_lib/limits";
import { geminiGenerateJson, listModels, pickModel, stripJsonFences } from "../../_lib/gemini";

const allowedCategories = ["STEM", "Sosyal", "Sanat", "Spor"] as const;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(ip, "event-fill");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit. Lütfen biraz bekleyip tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)) } }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Server API key missing" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const clubName = String(body.clubName ?? "").trim();
  const language = String(body.language ?? "tr").trim();
  const mode = String(body.mode ?? "tags").trim(); // "tags" | "rewrite"

  if (!title || !description) return NextResponse.json({ error: "title ve description zorunlu" }, { status: 400 });
  if (title.length > 120 || description.length > 2000) return NextResponse.json({ error: "metin çok uzun" }, { status: 400 });

  const ck = cacheKeyFrom({ route: "event-fill", title, description, clubName, language, mode });
  const cached = cacheGet(ck);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  const models = await listModels(apiKey);
  const model = pickModel(models);

  const schema = mode === "rewrite"
    ? `{ "improvedDescription": string }`
    : `{ "category":"STEM|Sosyal|Sanat|Spor", "tags": string[], "improvedDescription": string }`;

  const prompt = `
Sen bir okul kulüp etkinliği asistanısın. Sadece GEÇERLİ JSON döndür.
Dil: ${language}
Kulüp: ${clubName || "Bilinmiyor"}

Girdi:
Başlık: ${JSON.stringify(title)}
Açıklama: ${JSON.stringify(description)}

İstenen JSON şeması:
${schema}

Kurallar:
- JSON dışında hiçbir şey yazma.
- improvedDescription 300 karakteri geçmesin.
${mode === "rewrite" ? "" : "- tags 2-6 arası, kısa, lowercase.\n- category mutlaka listedeki değerlerden biri olsun."}
`.trim();

  // 429 olursa 1 kez retry (2s)
  let out = await geminiGenerateJson(apiKey, model, prompt);
  if (!out.ok && out.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    out = await geminiGenerateJson(apiKey, model, prompt);
  }
  if (!out.ok) {
    return NextResponse.json(
      { error: `Gemini hata (${out.status})`, detail: out.error, model, modelsFound: models.length },
      { status: out.status === 429 ? 429 : 500 }
    );
  }

  const cleaned = stripJsonFences(String(out.data));
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Model JSON döndürmedi", detail: cleaned.slice(0, 200), model }, { status: 500 });
  }

  let result: any = {};
  if (mode === "rewrite") {
    result.improvedDescription = String(parsed.improvedDescription ?? "").slice(0, 300);
    if (!result.improvedDescription) return NextResponse.json({ error: "Boş improvedDescription" }, { status: 500 });
  } else {
    const category = String(parsed.category ?? "");
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t).trim()).filter(Boolean) : [];
    const improvedDescription = String(parsed.improvedDescription ?? "").slice(0, 300);

    if (!allowedCategories.includes(category as any)) return NextResponse.json({ error: "Geçersiz kategori", category, model }, { status: 500 });
    if (tags.length < 2 || tags.length > 6) return NextResponse.json({ error: "Etiket sayısı 2-6 olmalı", tags, model }, { status: 500 });
    if (!improvedDescription) return NextResponse.json({ error: "Boş improvedDescription", model }, { status: 500 });

    result = { category, tags, improvedDescription };
  }

  const payload = { ...result, model, modelsFound: models.length };
  cacheSet(ck, payload);
  return NextResponse.json(payload);
}
