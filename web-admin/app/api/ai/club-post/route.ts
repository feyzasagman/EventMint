import { NextResponse } from "next/server";
import { cacheGet, cacheKeyFrom, cacheSet, rateLimit } from "../../_lib/limits";
import {
  extractJsonObject,
  getOpenAiApiKey,
  getOpenAiModel,
  openAiChat,
} from "../../_lib/openai";
import { clubPostFallback, shouldUseAiFallback } from "../../../../lib/aiFallbacks";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(ip, "club-post");
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit. Lütfen biraz bekleyin." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const clubName = String(body.clubName ?? "").trim();
  const topic = String(body.topic ?? "").trim();
  const language = String(body.language ?? "tr").trim();

  if (!topic) return NextResponse.json({ error: "topic zorunlu" }, { status: 400 });
  if (topic.length > 200) return NextResponse.json({ error: "topic çok uzun" }, { status: 400 });

  const ck = cacheKeyFrom({ route: "club-post", clubName, topic, language });
  const cached = cacheGet(ck);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  if (!getOpenAiApiKey()) {
    const fallback = clubPostFallback(topic, clubName);
    const payload = { ...fallback, model: "fallback-local", fallback: true };
    cacheSet(ck, payload);
    return NextResponse.json(payload);
  }

  const prompt = `
Kulüp duyuru asistanı. Sadece JSON döndür. Dil: ${language}
Kulüp: ${clubName || "Bilinmiyor"}
Konu: ${JSON.stringify(topic)}
{"text":"2-3 cümle","hashtags":["#tag1","#tag2","#tag3"]}`.trim();

  let out = await openAiChat(prompt, { maxOutputTokens: 150, temperature: 0.3 });
  if (!out.ok && out.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    out = await openAiChat(prompt, { maxOutputTokens: 150, temperature: 0.3 });
  }

  if (!out.ok) {
    if (shouldUseAiFallback(out.status)) {
      const fallback = clubPostFallback(topic, clubName);
      const payload = {
        ...fallback,
        model: "fallback-local",
        fallback: true,
        warning: out.message,
      };
      cacheSet(ck, payload);
      return NextResponse.json(payload);
    }
    return NextResponse.json({ error: out.message }, { status: out.status >= 400 ? out.status : 500 });
  }

  const parsed = extractJsonObject(out.text);
  if (!parsed) {
    const fallback = clubPostFallback(topic, clubName);
    const payload = { ...fallback, model: "fallback-local", fallback: true, warning: "Model JSON döndürmedi." };
    cacheSet(ck, payload);
    return NextResponse.json(payload);
  }

  const text = String(parsed.text ?? "").slice(0, 400);
  const hashtags = Array.isArray(parsed.hashtags)
    ? parsed.hashtags.map((h: unknown) => String(h).trim()).filter((h: string) => h.startsWith("#"))
    : [];

  if (!text || hashtags.length < 3 || hashtags.length > 6) {
    const fallback = clubPostFallback(topic, clubName);
    const payload = { ...fallback, model: "fallback-local", fallback: true, warning: "AI yanıtı geçersiz." };
    cacheSet(ck, payload);
    return NextResponse.json(payload);
  }

  const payload = { text, hashtags, model: out.model || getOpenAiModel() };
  cacheSet(ck, payload);
  return NextResponse.json(payload);
}
