"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
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

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
              setErr((fallbackError as any)?.message ?? JSON.stringify(fallbackError));
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
      } catch (e: any) {
        console.error("Firestore error:", e);
        setErr(e?.message ?? JSON.stringify(e));
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
    } catch (e: any) {
      console.error("Delete event error:", e);
      setNotice(`Silme basarisiz: ${e?.message ?? JSON.stringify(e)}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Events</h1>
        <Link
          href="/events/new"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          + Yeni Etkinlik
        </Link>
      </div>

      {loading && <p>Etkinlikler yukleniyor...</p>}
      {!loading && role !== "manager" && <p>Yetkin yok.</p>}

      {err && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
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
        <p>Henüz etkinlik bulunmuyor.</p>
      )}

      {!loading && !err && role === "manager" && events.length > 0 && (
        <ul className="space-y-4">
          {events.map((event) => (
            <li key={event.id} className="rounded-lg border p-4 shadow-sm">
              <h2 className="text-xl font-medium">{event.title ?? "Untitled Event"}</h2>
              {event.description && (
                <p className="mt-2 text-zinc-700 dark:text-zinc-300">{event.description}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                {event.clubId && <span>Kulup: {event.clubId}</span>}
                {event.category && <span>Kategori: {event.category}</span>}
                {event.location && <span>Konum: {event.location}</span>}
              </div>
              {event.tags && event.tags.length > 0 && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Tags: {event.tags.join(", ")}
                </p>
              )}
              <button
                type="button"
                onClick={() => handleDelete(event.id)}
                disabled={deletingId === event.id}
                className="mt-4 rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === event.id ? "Siliniyor..." : "Sil"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
