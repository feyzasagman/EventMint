"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import { normalizeAppRole } from "../../../../lib/role";
import { type ClubListItem, subscribeClubs } from "../../../../lib/clubRepo";
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

type EventAiAction = "fill" | "suggest_tags" | "improve_description";

type EventAiData = {
  title: string;
  category: string;
  location: string;
  description: string;
  tags: string[];
};

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const isDevMode = process.env.NODE_ENV === "development";

type AdminRole = "admin" | "club_manager" | "student";

type ModerationBlock = {
  risk: string;
  reason: string;
  suggestions: string[];
};

function normalizeRole(value: unknown): AdminRole {
  return normalizeAppRole(value);
}

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
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
  const [aiLoadingMode, setAiLoadingMode] = useState<EventAiAction | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiToast, setAiToast] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moderationBlock, setModerationBlock] = useState<ModerationBlock | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [clubs, setClubs] = useState<ClubListItem[]>([]);

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
          router.replace("/app/events");
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
    setModerationBlock(null);
  }, [title, description]);

  useEffect(() => {
    return subscribeClubs(setClubs);
  }, []);

  const persistEvent = async (statusValue: string) => {
    const eventClubId = role === "club_manager" ? userClubId.trim() : clubId.trim();
    if (!eventClubId) {
      throw new Error("Club ID gerekli.");
    }

    const { inferredCategory, inferredTags } = inferCategoryAndTags(title, description);
    const resolvedCategory = category.trim() || inferredCategory;
    const resolvedTags = tags.length > 0 ? tags : inferredTags;
    await addDoc(collection(db, "events"), {
      title,
      clubId: eventClubId,
      category: resolvedCategory,
      location,
      description,
      status: statusValue,
      tags: resolvedTags,
      createdAt: serverTimestamp(),
    });
  };

  const createEvent = async (statusOverride?: string) => {
    if (!hasAccess) {
      setError("Yetkin yok.");
      return;
    }

    setSaving(true);
    setError(null);
    setModerationBlock(null);
    setSuccess(false);

    try {
      await persistEvent(statusOverride ?? status);
      setSuccess(true);
      router.push("/events");
    } catch (err: unknown) {
      console.error("Create event error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!hasAccess) {
      setError("Yetkin yok.");
      return;
    }

    setSaving(true);
    setError(null);
    setModerationBlock(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/ai/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${title.trim()}\n${description.trim()}`,
          language: "tr",
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        risk?: string;
        reason?: string;
        suggestions?: string[];
        fallback?: boolean;
        warning?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Moderasyon kontrolü başarısız.");
        return;
      }

      if (!payload.ok) {
        setModerationBlock({
          risk: payload.risk ?? "high",
          reason: payload.reason ?? "İçerik yayına uygun değil.",
          suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
        });
        return;
      }

      if (payload.fallback) {
        setAiToast(
          payload.warning
            ? `Yerel moderasyon kullanıldı (${payload.warning})`
            : "Yerel moderasyon kullanıldı; yayın devam ediyor."
        );
      }

      await persistEvent("published");
      setSuccess(true);
      router.push("/events");
    } catch (err: unknown) {
      console.error("Publish event error:", err);
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

  const applyAiResult = (action: EventAiAction, data: EventAiData) => {
    if (action === "improve_description") {
      if (data.description) setDescription(data.description);
      if (data.tags.length > 0) setTags(data.tags);
      return;
    }

    if (action === "fill") {
      if (!title.trim() && data.title) setTitle(data.title);
      if (!category.trim() && data.category) setCategory(data.category);
      if (!location.trim() && data.location) setLocation(data.location);
      if (!description.trim() && data.description) setDescription(data.description);
    } else if (action === "suggest_tags") {
      if (!category.trim() && data.category) setCategory(data.category);
    }

    if (data.tags.length > 0) {
      setTags((current) => [...new Set([...current, ...data.tags])]);
    }
  };

  const callEventAi = async (action: EventAiAction) => {
    const payloadInput = {
      title: title.trim(),
      category: category.trim(),
      location: location.trim(),
      description: description.trim(),
      tags,
    };

    if (!payloadInput.title && !payloadInput.description) return;
    if (action === "improve_description" && !payloadInput.description) return;

    setAiLoadingMode(action);
    setAiError(null);
    setError(null);

    try {
      const response = await fetch("/api/ai/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payloadInput }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        data?: EventAiData;
        model?: string;
        cached?: boolean;
        fallback?: boolean;
        warning?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        const message =
          response.status === 429 && payload.error?.includes("hızlı")
            ? payload.error
            : payload.error
              ? `AI çağrısı başarısız: ${payload.error}`
              : `AI çağrısı başarısız (${response.status})`;
        setAiError(message);
        return;
      }

      if (!payload.data) {
        setAiError("Sunucudan eksik AI yanıtı alındı.");
        return;
      }

      if (payload.model) setAiModel(payload.model);
      applyAiResult(action, payload.data);

      if (payload.warning) {
        setAiToast(`Yedek öneri uygulandı (${payload.warning})`);
        return;
      }

      setAiToast(
        payload.cached
          ? "AI önerisi önbellekten uygulandı."
          : payload.fallback
            ? "Yedek öneri uygulandı (OpenAI geçici olarak kullanılamıyor)."
            : action === "fill"
              ? "Form AI ile dolduruldu."
              : action === "suggest_tags"
                ? "Etiket ve kategori önerildi."
                : "Açıklama iyileştirildi."
      );
    } catch {
      setAiError("AI çağrısı başarısız: ağ hatası. 30 sn sonra tekrar deneyin.");
    } finally {
      setAiLoadingMode(null);
    }
  };

  const aiBusy = aiLoadingMode !== null;
  const aiInputReady = Boolean(title.trim() || description.trim());
  const improveInputReady = Boolean(description.trim());

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
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          <Button
            type="button"
            onClick={() => callEventAi("fill")}
            disabled={aiBusy || !aiInputReady}
            className="min-h-9 px-3"
          >
            {aiLoadingMode === "fill" && (
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            ✨ AI ile doldur
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => callEventAi("suggest_tags")}
            disabled={aiBusy || !aiInputReady}
            className="min-h-9 px-3"
          >
            {aiLoadingMode === "suggest_tags" && (
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            Etiket+Kategori öner
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => callEventAi("improve_description")}
            disabled={aiBusy || !improveInputReady}
            className="min-h-9 px-3"
          >
            {aiLoadingMode === "improve_description" && (
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            Açıklamayı iyileştir
          </Button>
        </div>

        {isDevMode && (
          <p className="text-xs text-text2">Model (dev): {aiModel ?? "-"}</p>
        )}

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

        {aiError && (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {aiError}
          </p>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="tags">
            Tags
          </label>
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

        {moderationBlock && (
          <div
            role="alert"
            className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-danger"
          >
            <p className="font-semibold">Yayın engellendi</p>
            <p className="mt-1 text-sm">
              <span className="font-medium">Risk:</span> {moderationBlock.risk}
            </p>
            <p className="mt-2 text-sm">{moderationBlock.reason}</p>
            {moderationBlock.suggestions.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                {moderationBlock.suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}

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
            onClick={handlePublish}
            disabled={saving}
            variant="secondary"
          >
            {saving ? "Kontrol ediliyor..." : "Yayınla"}
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
