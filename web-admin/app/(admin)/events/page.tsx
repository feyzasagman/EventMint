"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { normalizeAppRole } from "../../../lib/role";
import { useRouter } from "next/navigation";
import { EmptyState } from "../../components/EmptyState";
import { EventCard } from "../../components/EventCard";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Chip } from "../../components/ui/chip";

type EventItem = {
  id: string;
  title?: string;
  description?: string;
  location?: string;
  clubId?: string;
  category?: string;
  tags?: string[];
  status?: string;
  createdAt?: { seconds?: number };
};

type AdminRole = "admin" | "club_manager" | "student";
type SessionItem = {
  id: string;
  eventId?: string;
  clubId?: string;
  active?: boolean;
  nonce?: string;
  createdAt?: Timestamp;
  expiresAt?: Timestamp;
};

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function pickTags(data: Record<string, unknown>) {
  const candidates = [data.tags, data.Etiketler, data.etiketler];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
    }
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.split(",").map((tag) => tag.trim()).filter(Boolean);
    }
  }
  return [];
}

function createNonce(length = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function createSessionExpiresAt() {
  return Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

const categories = ["Tümü", "STEM", "Sanat", "Spor", "Sosyal"];
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function normalizeRole(value: unknown): AdminRole {
  return normalizeAppRole(value);
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [userClubId, setUserClubId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startingQrId, setStartingQrId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [fixingClubIdEventId, setFixingClubIdEventId] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<SessionItem | null>(null);
  const [qrPayload, setQrPayload] = useState("");
  const [copied, setCopied] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tümü");

  useEffect(() => {
    let stopEventsListener: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user && !isDemoMode) {
        router.replace("/auth");
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const userSnapshot = user ? await getDoc(doc(db, "users", user.uid)) : null;
        const userData = userSnapshot?.exists() ? (userSnapshot.data() as Record<string, unknown>) : {};
        const userRole = isDemoMode && !user ? "admin" : normalizeRole(userData.role);
        const resolvedClubId = typeof userData.clubId === "string" ? userData.clubId : null;
        setRole(userRole);
        setUserClubId(resolvedClubId);

        if (userRole === "student") {
          router.replace("/app/events");
          setLoading(false);
          return;
        }

        if (userRole === "club_manager" && !resolvedClubId) {
          setEvents([]);
          setNotice("Kulüp yöneticisi hesabında clubId tanımlı değil.");
          setLoading(false);
          return;
        }

        const handleSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
          const items = snapshot.docs
            .map((eventDoc) => {
              const data = eventDoc.data() as Record<string, unknown>;
              return {
                id: eventDoc.id,
                title: pickString(data, ["title", "Baslik", "Başlık", "baslik", "başlık"]),
                description: pickString(data, ["description", "Tanim", "Tanım", "tanim", "tanım"]),
                location: pickString(data, ["location", "Konum", "konum"]),
                clubId: pickString(data, ["clubId", "Kulup", "Kulüp", "kulup", "kulüp", "club"]),
                category: pickString(data, ["category", "Kategori", "kategori"]),
                tags: pickTags(data),
                status: pickString(data, ["status", "durum", "Durum"]),
                createdAt: data.createdAt as EventItem["createdAt"],
              };
            })
            .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
          setEvents(items);
          setLoading(false);
        };

        const subscribeWithoutOrder = () => {
          const eventsQuery =
            userRole === "club_manager" && resolvedClubId
              ? query(collection(db, "events"), where("clubId", "==", resolvedClubId))
              : collection(db, "events");
          stopEventsListener = onSnapshot(eventsQuery, handleSnapshot, (fallbackError) => {
            console.error("Firestore error:", fallbackError);
            setErr(getErrorMessage(fallbackError));
            setLoading(false);
          });
        };

        const eventsQuery =
          userRole === "club_manager" && resolvedClubId
            ? query(collection(db, "events"), where("clubId", "==", resolvedClubId))
            : query(collection(db, "events"), orderBy("createdAt", "desc"));

        stopEventsListener = onSnapshot(eventsQuery, handleSnapshot, (snapshotError) => {
          console.warn("Falling back to unordered events query:", snapshotError);
          if (stopEventsListener) stopEventsListener();
          subscribeWithoutOrder();
        });
      } catch (e: unknown) {
        console.error("Firestore error:", e);
        setErr(getErrorMessage(e));
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (stopEventsListener) stopEventsListener();
    };
  }, [router]);

  const handleDelete = async (id: string) => {
    if (!confirm("Silinsin mi?")) return;
    setDeletingId(id);
    setNotice(null);
    try {
      await deleteDoc(doc(db, "events", id));
      setNotice("Etkinlik silindi.");
    } catch (e: unknown) {
      setNotice(`Silme basarisiz: ${getErrorMessage(e)}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartQr = async (eventId: string) => {
    const selectedEvent = events.find((item) => item.id === eventId);
    if (!selectedEvent) return;
    if (selectedEvent.status !== "published") {
      setNotice("QR sadece yayınlanmış etkinliklerde başlatılabilir.");
      return;
    }
    if (!selectedEvent.clubId) {
      setNotice("QR başlatmak için etkinlikte clubId olmalı.");
      return;
    }
    if (role === "club_manager" && userClubId && selectedEvent.clubId !== userClubId) {
      setNotice("Sadece kendi kulübünün etkinliğinde QR başlatabilirsin.");
      return;
    }

    setStartingQrId(eventId);
    setNotice(null);
    try {
      const now = Timestamp.now();
      const existingSnapshot = await getDocs(query(collection(db, "sessions"), where("eventId", "==", eventId)));
      const activeExisting = existingSnapshot.docs
        .map((sessionDoc) => ({ id: sessionDoc.id, ...(sessionDoc.data() as Omit<SessionItem, "id">) }))
        .filter((session) => session.active === true && (session.expiresAt?.toMillis() ?? 0) > now.toMillis())
        .sort((a, b) => (b.createdAt?.toDate().getTime() ?? 0) - (a.createdAt?.toDate().getTime() ?? 0))[0];

      if (activeExisting?.id && activeExisting.nonce) {
        setQrSession(activeExisting);
        setQrPayload(`${activeExisting.id}|${activeExisting.nonce}`);
        setNotice("Aktif session bulundu, mevcut QR gösteriliyor.");
        return;
      }

      const nonce = globalThis.crypto?.randomUUID?.() ?? createNonce();
      const expiresAt = createSessionExpiresAt();
      const sessionRef = await addDoc(collection(db, "sessions"), {
        eventId,
        clubId: selectedEvent.clubId,
        active: true,
        nonce,
        createdAt: serverTimestamp(),
        expiresAt,
        createdByUid: auth.currentUser?.uid ?? null,
      });

      setQrSession({ id: sessionRef.id, eventId, clubId: selectedEvent.clubId, active: true, nonce, expiresAt });
      setQrPayload(`${sessionRef.id}|${nonce}`);
    } catch (e: unknown) {
      setNotice(`QR oturumu baslatilamadi: ${getErrorMessage(e)}`);
    } finally {
      setStartingQrId(null);
    }
  };

  const handleCopyQrPayload = async () => {
    if (!qrPayload) return;
    await navigator.clipboard.writeText(qrPayload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleEndSession = async () => {
    if (!qrSession?.id) return;
    setEndingSession(true);
    try {
      await updateDoc(doc(db, "sessions", qrSession.id), { active: false });
      setQrSession(null);
      setQrPayload("");
      setNotice("Oturum sonlandırıldı.");
    } catch (e: unknown) {
      setNotice(`Oturum sonlandırılamadı: ${getErrorMessage(e)}`);
    } finally {
      setEndingSession(false);
    }
  };

  const handlePublish = async (eventId: string) => {
    setPublishingId(eventId);
    try {
      await updateDoc(doc(db, "events", eventId), { status: "published" });
      setNotice("Etkinlik yayınlandı.");
    } catch (e: unknown) {
      setNotice(`Yayınlama başarısız: ${getErrorMessage(e)}`);
    } finally {
      setPublishingId(null);
    }
  };

  const handleDraft = async (eventId: string) => {
    setPublishingId(eventId);
    try {
      await updateDoc(doc(db, "events", eventId), { status: "draft" });
      setNotice("Etkinlik taslağa alındı.");
    } catch (e: unknown) {
      setNotice(`Taslağa alma başarısız: ${getErrorMessage(e)}`);
    } finally {
      setPublishingId(null);
    }
  };

  const handleFixMissingClubId = async (eventId: string) => {
    if (!userClubId) {
      setNotice("Düzeltme için kullanıcı hesabında clubId tanımlı olmalı.");
      return;
    }
    setFixingClubIdEventId(eventId);
    try {
      await updateDoc(doc(db, "events", eventId), { clubId: userClubId });
      setNotice("Eksik clubId düzeltildi.");
    } catch (e: unknown) {
      setNotice(`clubId düzeltilemedi: ${getErrorMessage(e)}`);
    } finally {
      setFixingClubIdEventId(null);
    }
  };

  const filteredEvents = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      const searchable = [event.title, event.clubId, event.category, event.location, ...(event.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !queryText || searchable.includes(queryText);
      const matchesCategory =
        selectedCategory === "Tümü" || event.category?.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, selectedCategory]);

  const showEventDetail = (event: EventItem) => {
    alert(
      [
        event.title ?? "Untitled Event",
        event.clubId ? `Kulüp: ${event.clubId}` : null,
        event.category ? `Kategori: ${event.category}` : null,
        event.location ? `Konum: ${event.location}` : null,
        event.description ? `\\n${event.description}` : null,
      ]
        .filter(Boolean)
        .join("\\n")
    );
  };

  const canManageEvents = role === "admin" || role === "club_manager";

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Yönetim Paneli
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Etkinlikler</h1>
        </div>
        <Link
          href="/events/new"
          className="ui-button ui-button-brand px-5 shadow-sm"
        >
          + Yeni Etkinlik
        </Link>
      </div>

      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Etkinlik, kulüp, kategori veya konum ara"
            className="ui-input flex-1"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                variant={selectedCategory === category ? "brand" : "secondary"}
                className="min-h-8 rounded-full px-3 text-sm"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-48 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      )}
      {!loading && !canManageEvents && <p>Yetkin yok.</p>}
      {notice && <p className="mt-2 text-sm">{notice}</p>}
      {err && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{err}</p>}

      {!loading && !err && canManageEvents && filteredEvents.length > 0 && (
        <ul className="grid gap-5 md:grid-cols-2">
          {filteredEvents.map((event) => {
            const isPublished = event.status === "published";
            const canStartQr =
              isPublished && (role !== "club_manager" || !userClubId || event.clubId === userClubId);
            const hasMissingClubId = !event.clubId;
            return (
              <li key={event.id}>
                <EventCard
                  title={event.title}
                  description={event.description}
                  clubId={event.clubId}
                  category={event.category}
                  location={event.location}
                  tags={event.tags}
                  actions={
                    <>
                      <Button
                        type="button"
                        onClick={() => handleStartQr(event.id)}
                        disabled={startingQrId === event.id || !canStartQr}
                        variant="secondary"
                      >
                        {startingQrId === event.id ? "Başlatılıyor..." : "QR Başlat"}
                      </Button>
                      {!isPublished ? (
                        <Button
                          type="button"
                          onClick={() => handlePublish(event.id)}
                          disabled={publishingId === event.id}
                        >
                          {publishingId === event.id ? "Yayınlanıyor..." : "Yayınla"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => handleDraft(event.id)}
                          disabled={publishingId === event.id}
                          variant="secondary"
                        >
                          {publishingId === event.id ? "Güncelleniyor..." : "Taslağa al"}
                        </Button>
                      )}
                      {hasMissingClubId && (
                        <Chip className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          Eksik clubId
                        </Chip>
                      )}
                      {hasMissingClubId && (
                        <Button
                          type="button"
                          onClick={() => handleFixMissingClubId(event.id)}
                          disabled={fixingClubIdEventId === event.id || !userClubId}
                          variant="secondary"
                          className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950"
                        >
                          {fixingClubIdEventId === event.id ? "Düzeltiliyor..." : "Düzelt"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => handleDelete(event.id)}
                        disabled={deletingId === event.id}
                        variant="secondary"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        {deletingId === event.id ? "Siliniyor..." : "Sil"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => showEventDetail(event)}
                        variant="secondary"
                      >
                        Detay
                      </Button>
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !err && canManageEvents && events.length > 0 && filteredEvents.length === 0 && (
        <EmptyState
          icon="🔎"
          title="Sonuç bulunamadı"
          subtitle="Arama terimini veya kategori filtresini değiştir."
        />
      )}

      {!loading && !err && canManageEvents && events.length === 0 && (
        <EmptyState title="Henüz etkinlik yok" subtitle="İlk etkinliği oluşturduğunda QR oturumlarını buradan başlatabileceksin." />
      )}

      {qrSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <Card className="w-full max-w-3xl p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                  Check-in Session
                </p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight">QR Oturumu</h3>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setQrSession(null);
                  setQrPayload("");
                }}
                variant="secondary"
              >
                Kapat
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="flex flex-col items-center justify-center rounded-3xl bg-zinc-50 p-5 dark:bg-zinc-900">
                <div className="rounded-3xl bg-white p-4 shadow-sm">
                  <QRCodeSVG value={qrPayload} size={260} includeMargin />
                </div>
                <Button
                  type="button"
                  onClick={handleCopyQrPayload}
                  className="mt-4"
                >
                  {copied ? "Kopyalandı" : "Kopyala"}
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <p className="rounded-2xl bg-zinc-100 p-4 font-mono text-xs break-all dark:bg-zinc-900">{qrPayload}</p>
                <p className="text-zinc-600 dark:text-zinc-400">Mobilde QR tara veya kodu yapıştır.</p>
                <p>
                  <span className="font-medium">Session ID:</span> {qrSession.id}
                </p>
                <p>
                  <span className="font-medium">Nonce:</span> {qrSession.nonce}
                </p>
                <p>
                  <span className="font-medium">ExpiresAt:</span> {qrSession.expiresAt?.toDate().toLocaleString("tr-TR") ?? "-"}
                </p>
                <Button
                  type="button"
                  onClick={handleEndSession}
                  disabled={endingSession}
                  variant="secondary"
                  className="mt-2 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                >
                  {endingSession ? "Bitiriliyor..." : "Oturumu Bitir"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
