"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { normalizeAppRole } from "../../../lib/role";
import { COL } from "../../../lib/collections";
import {
  type ClubListItem,
  saveClub,
  subscribeClub,
  subscribeClubs,
} from "../../../lib/clubRepo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Chip } from "../../components/ui/chip";
import { ClubApplicationsPanel } from "../../components/ClubApplicationsPanel";
import { ClubMembersPanel } from "../../components/ClubMembersPanel";

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
  return "";
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  return [];
}

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function ClubPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [ownClubId, setOwnClubId] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [clubs, setClubs] = useState<ClubListItem[]>([]);
  const [clubName, setClubName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingClub, setLoadingClub] = useState(false);
  const [topic, setTopic] = useState("");
  const [postText, setPostText] = useState("");
  const [postHashtags, setPostHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [postToast, setPostToast] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [moderationBlock, setModerationBlock] = useState<ModerationBlock | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user && !isDemoMode) {
        router.replace("/auth?mode=admin");
        return;
      }

      try {
        const userSnapshot = user ? await getDoc(doc(db, "users", user.uid)) : null;
        const userData = userSnapshot?.exists() ? (userSnapshot.data() as Record<string, unknown>) : {};
        const resolvedRole = isDemoMode && !user ? "admin" : normalizeRole(userData.role);
        const clubId = typeof userData.clubId === "string" ? userData.clubId : "";

        if (resolvedRole === "student") {
          router.replace("/app/events");
          return;
        }

        setRole(resolvedRole);
        setOwnClubId(clubId);
        if (resolvedRole === "club_manager" && clubId) {
          setLoadingClub(true);
        }
        setSelectedClubId(resolvedRole === "club_manager" ? clubId : "");
      } finally {
        setCheckingAccess(false);
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    return subscribeClubs(setClubs);
  }, []);

  useEffect(() => {
    if (!postToast) return;
    const timer = window.setTimeout(() => setPostToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [postToast]);

  useEffect(() => {
    setModerationBlock(null);
  }, [topic, postText, postHashtags]);

  useEffect(() => {
    if (!selectedClubId) return;

    return subscribeClub(
      selectedClubId,
      (data) => {
        if (!data) {
          setClubName("");
          setDescription("");
          setTagsText("");
          setLoadingClub(false);
          return;
        }
        setClubName(pickString(data, ["ad", "Reklam"]));
        setDescription(pickString(data, ["aciklama"]));
        setTagsText(parseTags(data.etiketler).join(", "));
        setLoadingClub(false);
      },
      () => {
        setLoadingClub(false);
      }
    );
  }, [selectedClubId]);

  const canSave = useMemo(() => {
    if (role === "admin") return Boolean(selectedClubId.trim());
    if (role === "club_manager") return Boolean(ownClubId.trim());
    return false;
  }, [role, ownClubId, selectedClubId]);

  const canCreatePost = role === "club_manager" && Boolean(ownClubId.trim());

  const activeClubId = role === "club_manager" ? ownClubId : selectedClubId;

  const resolveClubName = () => {
    const name = clubName.trim();
    if (name) return name;
    const club = clubs.find((item) => item.id === activeClubId);
    return club?.label ?? "";
  };

  const handleAiClubPost = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) return;

    setAiLoading(true);
    setAiError(null);
    setPostError(null);
    try {
      const response = await fetch("/api/ai/club-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubName: resolveClubName(),
          topic: trimmedTopic,
          language: "tr",
        }),
      });

      const payload = (await response.json()) as {
        text?: string;
        hashtags?: string[];
        fallback?: boolean;
        warning?: string;
        error?: string;
      };

      if (!response.ok) {
        setAiError(payload.error ?? "AI paylaşım oluşturulamadı.");
        return;
      }

      if (!payload.text) {
        setAiError("Sunucudan eksik metin yanıtı alındı.");
        return;
      }

      setPostText(payload.text);
      setPostHashtags(Array.isArray(payload.hashtags) ? payload.hashtags : []);
      setNotice(
        payload.fallback
          ? "Yerel şablonla duyuru metni hazırlandı (OpenAI geçici olarak kullanılamıyor)."
          : "AI duyuru metni hazırlandı."
      );
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI paylaşım oluşturulamadı.");
    } finally {
      setAiLoading(false);
    }
  };

  const removeHashtag = (tag: string) => {
    setPostHashtags((current) => current.filter((item) => item !== tag));
  };

  const addHashtagFromInput = () => {
    let next = hashtagInput.trim();
    if (!next) return;
    if (!next.startsWith("#")) next = `#${next}`;
    setPostHashtags((current) => {
      if (current.includes(next) || current.length >= 6) return current;
      return [...current, next];
    });
    setHashtagInput("");
  };

  const resetPostForm = () => {
    setTopic("");
    setPostText("");
    setPostHashtags([]);
    setHashtagInput("");
    setModerationBlock(null);
    setPostError(null);
    setAiError(null);
  };

  const handleSharePost = async () => {
    if (!ownClubId) return;
    const user = auth.currentUser;
    if (!user && !isDemoMode) {
      setPostError("Paylaşım için giriş yapmalısınız.");
      return;
    }

    const trimmedTopic = topic.trim();
    const text = postText.trim();
    if (!trimmedTopic) {
      setPostError("Paylaşım konusu zorunlu.");
      return;
    }
    if (!text) {
      setPostError("Paylaşım metni boş olamaz.");
      return;
    }

    setSharing(true);
    setPostError(null);
    setModerationBlock(null);
    try {
      const response = await fetch("/api/ai/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${trimmedTopic}\n${text}\n${postHashtags.join(" ")}`,
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
        setPostError(payload.error ?? "Moderasyon kontrolü başarısız.");
        return;
      }

      if (!payload.ok) {
        setModerationBlock({
          risk: payload.risk ?? "high",
          reason: payload.reason ?? "Paylaşım yayına uygun değil.",
          suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
        });
        return;
      }

      if (payload.fallback) {
        setNotice(
          payload.warning
            ? `Yerel moderasyon kullanıldı: ${payload.warning}`
            : "Yerel moderasyon kullanıldı."
        );
      }

      const resolvedClubName = resolveClubName();
      await addDoc(collection(db, COL.clubPosts), {
        clubId: ownClubId,
        uid: user?.uid ?? "demo",
        clubName: resolvedClubName,
        topic: trimmedTopic,
        text,
        hashtags: postHashtags,
        createdAt: serverTimestamp(),
        createdByUid: user?.uid ?? "demo",
      });

      resetPostForm();
      setPostToast("Paylaşım yayınlandı.");
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Paylaşım kaydedilemedi.");
    } finally {
      setSharing(false);
    }
  };

  const handleSave = async () => {
    if (!activeClubId) return;
    setSaving(true);
    setNotice(null);
    try {
      await saveClub(activeClubId, {
        ad: clubName.trim(),
        Reklam: clubName.trim(),
        aciklama: description.trim(),
        etiketler: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      setNotice("Kulüp bilgileri güncellendi.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Kulüp kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (checkingAccess) {
    return <p>Yetki kontrol ediliyor...</p>;
  }

  if (role !== "admin" && role !== "club_manager") {
    return <p>Yetkin yok.</p>;
  }

  if (role === "club_manager" && !ownClubId) {
    return <p>Kulüp yöneticisi hesabında clubId tanımlı değil.</p>;
  }

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Kulüp Yönetimi</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">Kulübüm</h1>
      </div>

      {role === "admin" && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium" htmlFor="clubId">Kulüp</label>
          <select
            id="clubId"
            value={selectedClubId}
            onChange={(event) => {
              setLoadingClub(true);
              setNotice(null);
              setSelectedClubId(event.target.value);
            }}
            className="ui-input"
          >
            <option value="">Kulüp seç</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>{club.label}</option>
            ))}
          </select>
        </div>
      )}

      {loadingClub && <p>Kulüp yükleniyor...</p>}

      {canSave && (
        <Card className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="ad">Kulüp adı</label>
            <input
              id="ad"
              value={clubName}
              onChange={(event) => setClubName(event.target.value)}
              className="ui-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="aciklama">Açıklama</label>
            <textarea
              id="aciklama"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="ui-input min-h-28 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="etiketler">Etiketler</label>
            <input
              id="etiketler"
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="robotik, yazılım"
              className="ui-input"
            />
          </div>
          {notice && <p className="text-sm">{notice}</p>}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </Card>
      )}

      {activeClubId && <ClubApplicationsPanel clubId={activeClubId} />}
      {activeClubId && <ClubMembersPanel clubId={activeClubId} />}

      {canCreatePost && (
        <Card className="mt-6 space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Paylaşım oluştur</h2>
            <p className="mt-1 text-sm text-text2">
              Konu girin, AI ile duyuru metni üretin ve paylaşın.
            </p>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium" htmlFor="topic">
                Paylaşım konusu
              </label>
              <Button
                type="button"
                onClick={handleAiClubPost}
                disabled={aiLoading || sharing || !topic.trim()}
                className="min-h-9 px-3"
              >
                {aiLoading && (
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                ✨ AI ile paylaşım yaz
              </Button>
            </div>
            <input
              id="topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Örn: Haftalık kodlama atölyesi duyurusu"
              className="ui-input"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="postText">
              Paylaşım metni
            </label>
            <textarea
              id="postText"
              value={postText}
              onChange={(event) => setPostText(event.target.value)}
              rows={5}
              placeholder="Duyuru metni"
              className="ui-input min-h-32 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="hashtagInput">
              Hashtagler
            </label>
            <div className="flex flex-wrap gap-2">
              {postHashtags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeHashtag(tag)}
                  className="cursor-pointer"
                >
                  <Chip>{tag} ✕</Chip>
                </button>
              ))}
            </div>
            <input
              id="hashtagInput"
              value={hashtagInput}
              onChange={(event) => setHashtagInput(event.target.value)}
              onBlur={addHashtagFromInput}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addHashtagFromInput();
                }
              }}
              placeholder="#etkinlik, Enter ile ekle"
              className="ui-input mt-2"
            />
          </div>

          {aiError && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {aiError}
            </p>
          )}

          {moderationBlock && (
            <div
              role="alert"
              className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-danger"
            >
              <p className="font-semibold">Paylaşım engellendi</p>
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

          {postError && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {postError}
            </p>
          )}

          <Button
            type="button"
            onClick={handleSharePost}
            disabled={sharing || aiLoading || !topic.trim() || !postText.trim()}
          >
            {sharing ? "Kontrol ediliyor..." : "Paylaş"}
          </Button>
        </Card>
      )}

      {postToast && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50 rounded-xl border border-brand/40 bg-surface px-4 py-3 text-sm text-text shadow-lg">
          {postToast}
        </div>
      )}
    </section>
  );
}
