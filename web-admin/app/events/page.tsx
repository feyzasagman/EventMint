"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getUserRole } from "../../lib/role";
import { auth, db } from "../../lib/firebase";
import { useRouter } from "next/navigation";

type EventItem = {
  id: string;
  title?: string;
  description?: string;
  location?: string;
  clubId?: string;
  category?: string;
  tags?: string[];
  createdAt?: { seconds?: number };
};

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
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
      return candidate
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function createNonce(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function createSessionExpiresAt() {
  return Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 1000));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl dark:bg-indigo-950">
        <span aria-hidden>◌</span>
      </div>
      <h2 className="text-xl font-semibold">Henüz etkinlik yok</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        İlk etkinliği oluşturduğunda QR oturumlarını buradan başlatabileceksin.
      </p>
    </div>
  );
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startingQrId, setStartingQrId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let stopEventsListener: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const userRole = await getUserRole(user.uid);
        setRole(userRole);

        if (userRole !== "manager") {
          setLoading(false);
          return;
        }

        const handleSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
          const items = snapshot.docs
            .map((eventDoc) => ({
              ...(() => {
                const data = eventDoc.data() as Record<string, unknown>;
                return {
                  id: eventDoc.id,
                  title: pickString(data, ["title", "Baslik", "Başlık", "baslik", "başlık"]),
                  description: pickString(data, ["description", "Tanim", "Tanım", "tanim", "tanım"]),
                  location: pickString(data, ["location", "Konum", "konum"]),
                  clubId: pickString(data, ["clubId", "Kulup", "Kulüp", "kulup", "kulüp", "club"]),
                  category: pickString(data, ["category", "Kategori", "kategori"]),
                  tags: pickTags(data),
                  createdAt: data.createdAt as EventItem["createdAt"],
                };
              })(),
            }))
            .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
          setEvents(items);
          setLoading(false);
        };

        const subscribeWithoutOrder = () => {
          stopEventsListener = onSnapshot(
            collection(db, "events"),
            handleSnapshot,
            (fallbackError) => {
              console.error("Firestore error:", fallbackError);
              setErr(getErrorMessage(fallbackError));
              setLoading(false);
            }
          );
        };

        stopEventsListener = onSnapshot(
          query(collection(db, "events"), orderBy("createdAt", "desc")),
          handleSnapshot,
          (snapshotError) => {
            console.warn("Falling back to unordered events query:", snapshotError);
            if (stopEventsListener) {
              stopEventsListener();
            }
            subscribeWithoutOrder();
          }
        );
      } catch (e: unknown) {
        console.error("Firestore error:", e);
        setErr(getErrorMessage(e));
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (stopEventsListener) {
        stopEventsListener();
      }
    };
  }, [router]);

  const handleDelete = async (id: string) => {
    if (!confirm("Silinsin mi?")) {
      return;
    }

    setDeletingId(id);
    setNotice(null);
    try {
      await deleteDoc(doc(db, "events", id));
      setNotice("Etkinlik silindi.");
    } catch (e: unknown) {
      console.error("Delete event error:", e);
      setNotice(`Silme basarisiz: ${getErrorMessage(e)}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartQr = async (eventId: string) => {
    setStartingQrId(eventId);
    setNotice(null);

    try {
      const expiresAt = createSessionExpiresAt();
      const sessionRef = await addDoc(collection(db, "sessions"), {
        eventId,
        active: true,
        createdAt: serverTimestamp(),
        expiresAt,
        nonce: createNonce(),
      });

      router.push(`/events/${eventId}/qr?sessionId=${sessionRef.id}`);
    } catch (e: unknown) {
      console.error("Create session error:", e);
      setNotice(`QR oturumu baslatilamadi: ${getErrorMessage(e)}`);
    } finally {
      setStartingQrId(null);
    }
  };

  const showEventDetail = (event: EventItem) => {
    alert(
      [
        event.title ?? "Untitled Event",
        event.clubId ? `Kulüp: ${event.clubId}` : null,
        event.category ? `Kategori: ${event.category}` : null,
        event.location ? `Konum: ${event.location}` : null,
        event.description ? `\n${event.description}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Yönetim Paneli
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Etkinlikler</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Etkinlikleri yönet, check-in QR oturumlarını başlat ve demo akışını kontrol et.
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500"
        >
          + Yeni Etkinlik
        </Link>
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-48 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      )}
      {!loading && role !== "manager" && <p>Yetkin yok.</p>}

      {err && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          Etkinlikler yuklenirken bir hata olustu.
        </p>
      )}
      {err && (
        <pre style={{ color: "salmon", whiteSpace: "pre-wrap" }}>
          {err}
        </pre>
      )}
      {notice && <p className="mt-2 text-sm">{notice}</p>}

      {!loading && !err && role === "manager" && events.length === 0 && (
        <EmptyState />
      )}

      {!loading && !err && role === "manager" && events.length > 0 && (
        <ul className="grid gap-5 md:grid-cols-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex min-h-64 flex-col rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-200/60 transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/20"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">{event.title ?? "Untitled Event"}</h2>
                {event.category && (
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {event.category}
                  </span>
                )}
              </div>
              {event.description && (
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {event.description}
                </p>
              )}
              <div className="mt-4 grid gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                {event.clubId && (
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden>👥</span> {event.clubId}
                  </span>
                )}
                {event.location && (
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden>📍</span> {event.location}
                  </span>
                )}
              </div>
              {event.tags && event.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {event.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                  {event.tags.length > 4 && (
                    <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 dark:border-zinc-800">
                      +{event.tags.length - 4}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-auto flex flex-wrap justify-end gap-2 pt-6">
                <button
                  type="button"
                  onClick={() => handleStartQr(event.id)}
                  disabled={startingQrId === event.id}
                  className="rounded-xl bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
                >
                  {startingQrId === event.id ? "Baslatiliyor..." : "QR Başlat"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(event.id)}
                  disabled={deletingId === event.id}
                  className="rounded-xl border border-red-200 px-3.5 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === event.id ? "Siliniyor..." : "Sil"}
                </button>
                <button
                  type="button"
                  onClick={() => showEventDetail(event)}
                  className="rounded-xl border border-zinc-300 px-3.5 py-2 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Detay
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
