"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Chip } from "../../../components/ui/chip";

const CATEGORY_KEYWORDS = {
  Spor: ["turnuva", "maç", "antrenman", "basketbol", "voleybol"],
  Sanat: ["tiyatro", "prova", "konser", "sergi", "müzik"],
  STEM: ["robot", "yazılım", "kod", "hackathon", "arduino"],
  Sosyal: ["bağış", "gönüllü", "yardım", "sosyal sorumluluk"],
} as const;

function inferCategoryAndTags(title: string, description: string) {
  const text = `${title} ${description}`.toLocaleLowerCase("tr-TR");
  const tags = new Set<string>();
  let inferredCategory = "";
  let maxMatches = 0;

  for (const [categoryName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let categoryMatches = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLocaleLowerCase("tr-TR"))) {
        tags.add(keyword);
        categoryMatches += 1;
      }
    }

    if (categoryMatches > maxMatches) {
      maxMatches = categoryMatches;
      inferredCategory = categoryName;
    }
  }

  return { inferredCategory, inferredTags: Array.from(tags) };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const ALLOWED_CATEGORIES = ["STEM", "Sosyal", "Sanat", "Spor"] as const;
const MODEL_PRIORITY = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
  "gemini-1.5-pro-latest",
] as const;
const AI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AI_CACHE_PREFIX = "eventmint:ai-fill:";

let cachedGenerationModels: string[] | null = null;
let cachedGenerationModelCount = 0;

type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

type AdminRole = "admin" | "club_manager" | "student";

type ClubOption = {
  id: string;
  label: string;
};

function normalizeRole(value: unknown): AdminRole {
  if (value === "admin" || value === "club_manager" || value === "student") {
    return value;
  }
  if (value === "manager") {
    return "club_manager";
  }
  return "student";
}

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function cleanJsonText(raw: string) {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenceMatch?.[1] ?? trimmed).trim();
}

function parseAiPayload(payload: unknown): {
  category: AllowedCategory;
  tags: string[];
  improvedDescription: string;
} {
  if (typeof payload !== "object" || payload == null) {
    throw new Error("AI yanıtı beklenen formatta değil.");
  }
  const data = payload as Record<string, unknown>;
  const category = String(data.category ?? "").trim() as AllowedCategory;
  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new Error("Kategori geçersiz.");
  }

  if (!Array.isArray(data.tags)) {
    throw new Error("Tags alanı geçersiz.");
  }
  const tags = data.tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 6);
  if (tags.length < 2 || tags.length > 6) {
    throw new Error("Tags 2-6 aralığında olmalı.");
  }

  const improvedDescription = String(data.improvedDescription ?? "").trim();
  if (!improvedDescription) {
    throw new Error("Açıklama boş olamaz.");
  }
  if (improvedDescription.length > 300) {
    throw new Error("Açıklama 300 karakteri geçiyor.");
  }

  return {
    category,
    tags: Array.from(new Set(tags)),
    improvedDescription,
  };
}

function buildAiCacheKey(title: string, description: string) {
  const normalized = `${title.trim().toLocaleLowerCase("tr-TR")}||${description
    .trim()
    .toLocaleLowerCase("tr-TR")}`;
  return `${AI_CACHE_PREFIX}${encodeURIComponent(normalized)}`;
}

function readAiCache(key: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      category: AllowedCategory;
      tags: string[];
      improvedDescription: string;
      model?: string;
      cachedAt: number;
    };
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > AI_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeAiCache(
  key: string,
  data: { category: AllowedCategory; tags: string[]; improvedDescription: string; model?: string }
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...data,
        cachedAt: Date.now(),
      })
    );
  } catch {
    // cache best-effort
  }
}

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [clubId, setClubId] = useState("");
  const [userClubId, setUserClubId] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiToast, setAiToast] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [availableModelCount, setAvailableModelCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [clubs, setClubs] = useState<ClubOption[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user && !isDemoMode) {
        router.replace("/auth");
        return;
      }

      try {
        const userSnapshot = user ? await getDoc(doc(db, "users", user.uid)) : null;
        const userData = userSnapshot?.exists() ? (userSnapshot.data() as Record<string, unknown>) : {};
        const resolvedRole = isDemoMode && !user ? "admin" : normalizeRole(userData.role);
        const resolvedClubId = typeof userData.clubId === "string" ? userData.clubId : "";
        setRole(resolvedRole);
        setUserClubId(resolvedClubId);
        setHasAccess(resolvedRole === "admin" || resolvedRole === "club_manager");
        if (resolvedRole === "club_manager") {
          setClubId(resolvedClubId);
        }
        if (resolvedRole === "student") {
          router.replace("/auth");
        }
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setCheckingAccess(false);
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!aiToast) return;
    const timer = window.setTimeout(() => setAiToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [aiToast]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "Kulüpler"), (snapshot) => {
      setClubs(
        snapshot.docs.map((clubDoc) => {
          const data = clubDoc.data() as Record<string, unknown>;
          return {
            id: clubDoc.id,
            label: pickString(data, ["name", "title", "ad", "Ad", "clubId"]) ?? clubDoc.id,
          };
        })
      );
    });

    return unsubscribe;
  }, []);

  const createEvent = async (statusOverride?: string) => {
    if (!hasAccess) {
      setError("Yetkin yok.");
      return;
    }

    const eventClubId = role === "club_manager" ? userClubId.trim() : clubId.trim();
    if (!eventClubId) {
      setError("Club ID gerekli.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { inferredCategory, inferredTags } = inferCategoryAndTags(title, description);
      const resolvedCategory = category.trim() || inferredCategory;
      const resolvedTags = tags.length > 0 ? tags : inferredTags;
      await addDoc(collection(db, "events"), {
        title,
        clubId: eventClubId,
        category: resolvedCategory,
        location,
        description,
        status: statusOverride ?? status,
        tags: resolvedTags,
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      router.push("/events");
    } catch (err: unknown) {
      console.error("Create event error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await createEvent();
  };

  const addTagFromInput = () => {
    const next = tagInput.trim();
    if (!next) return;
    setTags((current) => {
      if (current.includes(next)) return current;
      if (current.length >= 6) return current;
      return [...current, next];
    });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags((current) => current.filter((item) => item !== tag));
  };

  const handleAiFill = async () => {
    if (!title.trim() || !description.trim()) return;
    if (!geminiApiKey) {
      setAiError("Gemini API key bulunamadı (.env.local).");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setError(null);
    try {
      const cacheKey = buildAiCacheKey(title, description);
      const cached = readAiCache(cacheKey);
      if (cached) {
        setCategory(cached.category);
        setTags(cached.tags);
        setDescription(cached.improvedDescription);
        setAiModel(cached.model ?? aiModel);
        setAiToast("Son AI sonucu önbellekten uygulandı.");
        return;
      }

      const prompt = [
        "Türkçe yaz, sadece geçerli JSON döndür:",
        '{ "category":"STEM|Sosyal|Sanat|Spor", "tags":["..."], "improvedDescription":"..." }',
        "Kurallar:",
        "- tags 2-6 arası",
        "- improvedDescription 300 karakteri geçmesin",
        "- JSON dışında hiçbir şey yazma",
        "",
        `Title: ${title}`,
        `Description: ${description}`,
      ].join("\n");

      const callGemini = async (model: string) => {
        const endpoint =
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 300,
            },
          }),
        });

        if (!response.ok) {
          const responseText = await response.text();
          const error = new Error(
            `Gemini çağrısı başarısız (${response.status}) - ${(responseText || "boş response").slice(0, 200)}`
          ) as Error & { status?: number };
          error.status = response.status;
          throw error;
        }

        return response.json() as Promise<{
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        }>;
      };

      let normalized: string[];
      if (cachedGenerationModels) {
        normalized = cachedGenerationModels;
      } else {
        const modelsResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`
        );
        if (!modelsResponse.ok) {
          const modelListText = await modelsResponse.text();
          throw new Error(
            `Model listesi alınamadı (${modelsResponse.status}) - ${(modelListText || "boş response").slice(0, 200)}`
          );
        }

        const modelsJson = (await modelsResponse.json()) as {
          models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
        };
        const generationModels = (modelsJson.models ?? []).filter((model) =>
          (model.supportedGenerationMethods ?? []).includes("generateContent")
        );
        normalized = generationModels
          .map((model) => (model.name ?? "").replace(/^models\//, ""))
          .filter(Boolean);
        cachedGenerationModels = normalized;
        cachedGenerationModelCount = normalized.length;
      }
      setAvailableModelCount(cachedGenerationModelCount || normalized.length);

      const selectedModel =
        MODEL_PRIORITY.find((candidate) => normalized.includes(candidate)) ??
        normalized[0];

      if (!selectedModel) {
        throw new Error("Uygun generateContent modeli bulunamadı.");
      }

      const responseResult = await callGemini(selectedModel);
      setAiModel(selectedModel);

      const text = (responseResult.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("AI boş yanıt döndürdü.");

      const cleaned = cleanJsonText(text);
      const parsed = parseAiPayload(JSON.parse(cleaned));

      setCategory(parsed.category);
      setTags(parsed.tags);
      setDescription(parsed.improvedDescription);
      writeAiCache(cacheKey, {
        category: parsed.category,
        tags: parsed.tags,
        improvedDescription: parsed.improvedDescription,
        model: selectedModel,
      });
      setAiToast("Alanlar AI ile dolduruldu.");
    } catch (aiFillError) {
      const message =
        aiFillError instanceof Error ? aiFillError.message : "AI doldurma başarısız.";
      const isQuotaError =
        message.includes("(429)") ||
        message.toLowerCase().includes("resource_exhausted") ||
        message.toLowerCase().includes("kota");

      if (isQuotaError) {
        const cacheKey = buildAiCacheKey(title, description);
        const cached = readAiCache(cacheKey);
        if (cached) {
          setCategory(cached.category);
          setTags(cached.tags);
          setDescription(cached.improvedDescription);
          setAiModel(cached.model ?? aiModel);
          setAiError("AI kotası dolu. Son sonucu tekrar kullanabilir veya manuel devam edebilirsin.");
          setAiToast("Kota dolu: son önbellek sonucu uygulandı.");
          return;
        }
        const { inferredCategory, inferredTags } = inferCategoryAndTags(
          title,
          description
        );
        if (!category.trim() && inferredCategory) {
          setCategory(inferredCategory);
        }
        if (tags.length === 0 && inferredTags.length > 0) {
          setTags(inferredTags.slice(0, 6));
        }
        setAiError("AI kotası dolu. Son sonucu tekrar kullanabilir veya manuel devam edebilirsin.");
        setAiToast("AI kotası dolu: yerel öneri uygulandı.");
      } else {
        setAiError(message);
      }
    } finally {
      setAiLoading(false);
    }
  };

  if (checkingAccess) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p>Yetki kontrol ediliyor...</p>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="mb-4 text-3xl font-semibold">Yeni Etkinlik</h1>
        <p>Yetkin yok.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-3xl font-semibold">Yeni Etkinlik</h1>

      <Card className="p-5">
        <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="ui-input"
          />
        </div>

        {role === "admin" && (
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="clubId">
              Club ID
            </label>
            <select
              id="clubId"
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              required
              className="ui-input"
            >
              <option value="">Kulüp seç</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="category">
            Category
          </label>
          <input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="ui-input"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="location">
            Location
          </label>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className="ui-input"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="ui-input min-h-24 py-2"
          />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm font-medium" htmlFor="tags">
              Tags
            </label>
            <Button
              type="button"
              onClick={handleAiFill}
              disabled={aiLoading || !title.trim() || !description.trim()}
              className="min-h-9 px-3"
            >
              {aiLoading && (
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              ✨ AI ile doldur
            </Button>
          </div>
          <p className="mb-2 text-xs text-text2">
            Model: {aiModel ?? "-"}
            {availableModelCount > 0 ? ` (${availableModelCount} model bulundu)` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button key={tag} type="button" onClick={() => removeTag(tag)} className="cursor-pointer">
                <Chip>{tag} ✕</Chip>
              </button>
            ))}
          </div>
          <input
            id="tags"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onBlur={addTagFromInput}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addTagFromInput();
              }
            }}
            placeholder="Etiket ekle, Enter ile onayla"
            className="ui-input mt-2"
          />
          {aiError && <p className="mt-2 text-sm text-danger">{aiError}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ui-input"
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </div>

        {error && (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-danger">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-xl border border-brand/40 bg-brand/15 px-3 py-2 text-text">
            Kaydedildi.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={saving}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
          <Button
            type="button"
            onClick={() => createEvent("published")}
            disabled={saving}
            variant="secondary"
          >
            Yayınla
          </Button>
        </div>
        </form>
      </Card>
      {aiToast && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50 rounded-xl border border-brand/40 bg-surface px-4 py-3 text-sm text-text shadow-lg">
          {aiToast}
        </div>
      )}
    </main>
  );
}
