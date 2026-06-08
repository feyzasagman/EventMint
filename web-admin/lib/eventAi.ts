export type ImproveDescriptionInput = {
  title: string;
  category: string;
  location: string;
  description: string;
  existingTags?: string[];
};

export type ImproveDescriptionResult = {
  description: string;
  tags: string[];
};

const STOPWORDS = new Set([
  "ve",
  "veya",
  "ile",
  "için",
  "bir",
  "bu",
  "da",
  "de",
  "mi",
  "mu",
  "mı",
  "olan",
  "gibi",
  "kadar",
  "daha",
  "çok",
  "az",
  "her",
  "the",
  "and",
  "or",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "at",
  "etkinlik",
  "etkinliği",
  "kampüs",
  "öğrenci",
  "öğrenciler",
  "katılım",
  "için",
]);

export function normalizeEventTag(raw: string): string | null {
  const tag = raw
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16);

  return tag.length >= 2 ? tag : null;
}

export function normalizeEventTags(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of value) {
    const tag = normalizeEventTag(String(item));
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return tags.slice(0, max);
}

function tokenize(text: string): string[] {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export function extractTagsFromText(
  title: string,
  category: string,
  description: string,
  location = "",
  min = 3,
  max = 7
): string[] {
  const source = `${title} ${category} ${location} ${description}`;
  const words = tokenize(source);
  const freq = new Map<string, number>();

  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  const ranked = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr-TR"))
    .map(([word]) => normalizeEventTag(word))
    .filter((tag): tag is string => Boolean(tag));

  const unique = [...new Set(ranked)];
  const fallbackPool = ["etkinlik", "kampüs", "kulüp", "öğrenci", "atölye", "workshop"];
  for (const item of fallbackPool) {
    if (unique.length >= min) break;
    const tag = normalizeEventTag(item);
    if (tag && !unique.includes(tag)) unique.push(tag);
  }

  return unique.slice(0, max);
}


export function improveDescriptionFallback(
  input: ImproveDescriptionInput
): ImproveDescriptionResult {
  const title = input.title.trim() || "Kampüs Etkinliği";
  const category = input.category.trim();
  const location = input.location.trim() || "kampüs";
  const base = input.description.trim();

  let description = base;

  if (!base) {
    description = `${title} etkinliğine davetlisiniz. Katılım için kayıt önerilir.`;
  } else {
    const normalized =
      base.charAt(0).toLocaleUpperCase("tr-TR") +
      base.slice(1).replace(/\s+/g, " ").trim();
    const endsWithPunctuation = /[.!?]$/.test(normalized);
    const categoryPart = category ? `${category} alanında ` : "";
    description = endsWithPunctuation
      ? `${normalized} ${title} etkinliği ${location} konumunda ${categoryPart}öğrencilere açıktır.`
      : `${normalized}. ${title} etkinliği ${location} konumunda ${categoryPart}öğrencilere açıktır.`;
  }

  const tags = extractTagsFromText(
    title,
    category,
    base || description,
    location,
    3,
    7
  );

  return { description, tags };
}

export function buildImproveDescriptionPrompt(input: ImproveDescriptionInput): string {
  const context = `
title: ${JSON.stringify(input.title)}
category: ${JSON.stringify(input.category)}
location: ${JSON.stringify(input.location)}
description: ${JSON.stringify(input.description)}
existingTags: ${JSON.stringify(input.existingTags ?? [])}`.trim();

  return `Dil: Türkçe. Okul kulüp etkinliği asistanısın.
Amaç: Bir kulüp etkinliği açıklamasını daha profesyonel ve davetkâr yap, sonra uygun etiketler üret.
Aşağıdaki etkinlik bilgilerine göre description'ı 1-2 cümleyle iyileştir ve 3-7 arası etiket üret.
Etiketler kısa olsun, küçük harf, Türkçe karakterleri koru, tekrar yok, boşluk yerine tire (-) kullan, maksimum 16 karakter tercih et.
title, category ve location alanlarını değiştirme; sadece description ve tags üret.
Çıktı: Sadece JSON (markdown yok).
${context}
{"description":"...","tags":["..."]}`;
}

export function parseImproveDescriptionResponse(
  parsed: Record<string, unknown>,
  input: ImproveDescriptionInput
): ImproveDescriptionResult {
  const description = String(parsed.description ?? input.description).trim();
  const tags = normalizeEventTags(parsed.tags, 7);

  return {
    description: description || input.description,
    tags:
      tags.length > 0
        ? tags
        : extractTagsFromText(
            input.title,
            input.category,
            description,
            input.location,
            3,
            7
          ),
  };
}

export function improveDescriptionAndTags(
  input: ImproveDescriptionInput,
  aiText?: string
): ImproveDescriptionResult {
  if (!aiText) {
    return improveDescriptionFallback(input);
  }

  const match = aiText.match(/\{[\s\S]*\}/);
  if (!match) {
    return improveDescriptionFallback(input);
  }

  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return parseImproveDescriptionResponse(parsed, input);
  } catch {
    return improveDescriptionFallback(input);
  }
}
