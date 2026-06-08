export type ModerationResult = {
  ok: boolean;
  risk: "low" | "medium" | "high";
  reason: string;
  suggestions: string[];
};

const BLOCKED_PATTERNS = [
  /\b(amk|aq|mk|orospu|piç|sik|yarrak|ananı|babanı)\b/i,
  /\b(nazi|nefret|öldür|intihar)\b/i,
];

export function moderateFallback(text: string): ModerationResult {
  const normalized = text.toLocaleLowerCase("tr-TR");

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        ok: false,
        risk: "high",
        reason: "Metin uygunsuz ifade içerebilir.",
        suggestions: ["Hakaret veya uygunsuz ifadeleri kaldırın."],
      };
    }
  }

  return {
    ok: true,
    risk: "low",
    reason: "Yerel kontrol: belirgin risk bulunmadı.",
    suggestions: [],
  };
}

export function clubPostFallback(topic: string, clubName: string) {
  const club = clubName.trim() || "Kulübümüz";
  const cleanTopic = topic.trim() || "duyuru";
  const tagBase = cleanTopic
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join("-")
    .slice(0, 16);

  const hashtags = [
    "#kampüs",
    "#kulüp",
    tagBase ? `#${tagBase}` : "#etkinlik",
  ];

  return {
    text: `${club}, ${cleanTopic} hakkında yeni bir duyuru paylaştı. Detaylar için kulüp sayfasını takip edebilirsiniz.`,
    hashtags,
  };
}

export function shouldUseAiFallback(status: number): boolean {
  return status === 429 || status === 401 || status === 403 || status >= 500;
}
