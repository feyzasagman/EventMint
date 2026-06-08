"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { EmptyState } from "../../../components/EmptyState";
import { EventCard } from "../../../components/EventCard";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Chip } from "../../../components/ui/chip";
import { auth, db } from "../../../../lib/firebase";
import { COL } from "../../../../lib/collections";

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

const categories = ["Tümü", "STEM", "Sanat", "Spor", "Sosyal"];

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function pickTags(data: Record<string, unknown>) {
  for (const value of [data.tags, data.Etiketler, data.etiketler]) {
    if (Array.isArray(value)) {
      return value.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
    }
    if (typeof value === "string" && value.trim()) {
      return value.split(",").map((tag) => tag.trim()).filter(Boolean);
    }
  }
  return [];
}

function mapEvents(snapshot: QuerySnapshot<DocumentData>) {
  return snapshot.docs
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
        createdAt: data.createdAt as EventItem["createdAt"],
      };
    })
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export default function UserEventsPage() {
  const router = useRouter();
  const [uid, setUid] = useState("demo-user");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [rsvps, setRsvps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tümü");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? "demo-user");
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let fallbackStop: (() => void) | null = null;
    const handleSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      const items = mapEvents(snapshot);
      if (items.length === 0 && !fallbackStop) {
        fallbackStop = onSnapshot(collection(db, "Etkinlikler"), (fallbackSnapshot) => {
          setEvents(mapEvents(fallbackSnapshot));
          setLoading(false);
        });
        return;
      }
      setEvents(items);
      setLoading(false);
    };

    const stop = onSnapshot(
      query(collection(db, "events"), orderBy("createdAt", "desc")),
      handleSnapshot,
      () => {
        fallbackStop = onSnapshot(collection(db, "Etkinlikler"), handleSnapshot, (fallbackError) => {
          setError(fallbackError.message);
          setLoading(false);
        });
      }
    );

    return () => {
      stop();
      fallbackStop?.();
    };
  }, []);

  useEffect(() => {
    if (uid === "demo-user") return;
    const stop = onSnapshot(
      query(collection(db, COL.rsvps), where("uid", "==", uid)),
      (snapshot) => setRsvps(new Set(snapshot.docs.map((docSnapshot) => String(docSnapshot.data().eventId ?? "")))),
      () => setRsvps(new Set())
    );
    return stop;
  }, [uid]);

  const joinEvent = async (eventId: string) => {
    if (uid === "demo-user") return;
    setJoiningId(eventId);
    try {
      await setDoc(
        doc(db, COL.rsvps, `${eventId}_${uid}`),
        {
          eventId,
          uid,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      setRsvps((current) => new Set(current).add(eventId));
    } finally {
      setJoiningId(null);
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

  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Öğrenci Paneli</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">Etkinlikler</h1>
        <p className="mt-2 text-sm text-text2">Kulüp etkinliklerini keşfet ve katılımını bildir.</p>
      </div>

      <Card className="mb-6 p-4">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Etkinlik, kulüp, kategori veya konum ara"
          className="ui-input"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              type="button"
              variant={selectedCategory === category ? "brand" : "secondary"}
              onClick={() => setSelectedCategory(category)}
              className="min-h-8 rounded-full px-3 text-sm"
            >
              {category}
            </Button>
          ))}
        </div>
      </Card>

      {loading && <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-3xl bg-surface2" />)}</div>}
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      {!loading && !error && filteredEvents.length === 0 && (
        <EmptyState title="Etkinlik bulunamadı" subtitle="Arama veya kategori filtresini değiştir." icon="🔎" />
      )}

      {filteredEvents.length > 0 && (
        <ul className="grid gap-5 md:grid-cols-2">
          {filteredEvents.map((event) => {
            const isJoined = rsvps.has(event.id);
            return (
              <li key={event.id}>
                <EventCard
                  {...event}
                  href={`/app/events/${event.id}`}
                  actions={
                    isJoined ? (
                      <Button type="button" variant="secondary" onClick={() => router.push(`/app/events/${event.id}`)}>
                        Detay / QR
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => joinEvent(event.id)}
                        disabled={joiningId === event.id}
                      >
                        {joiningId === event.id ? "Kaydediliyor..." : "Katılacağım"}
                      </Button>
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
