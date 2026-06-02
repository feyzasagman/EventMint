"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, DocumentData, onSnapshot, orderBy, query, QuerySnapshot } from "firebase/firestore";
import { EmptyState } from "../../../components/EmptyState";
import { EventCard } from "../../../components/EventCard";
import { db } from "../../../../lib/firebase";

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
const tags = ["arduino", "robotik", "tiyatro", "konser", "turnuva", "bağış", "yazılım", "sergi"];

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function pickTags(data: Record<string, unknown>) {
  for (const value of [data.tags, data.Etiketler, data.etiketler]) {
    if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
    if (typeof value === "string" && value.trim()) return value.split(",").map((tag) => tag.trim()).filter(Boolean);
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

export default function UserDiscoverPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tümü");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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
      const matchesTag =
        selectedTag == null || event.tags?.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase());
      return matchesSearch && matchesCategory && matchesTag;
    });
  }, [events, searchQuery, selectedCategory, selectedTag]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("Tümü");
    setSelectedTag(null);
  };

  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">Keşfet</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">Yeni etkinlikler bul</h1>
        <p className="mt-2 text-sm text-slate-600">Kategori ve etiketlerle ilgini çeken etkinlikleri filtrele.</p>
      </div>

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Etkinlik, kulüp, kategori, konum veya etiket ara"
          className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${selectedCategory === category ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${selectedTag === tag ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}
            >
              {tag}
            </button>
          ))}
          {(searchQuery || selectedCategory !== "Tümü" || selectedTag) && (
            <button type="button" onClick={clearFilters} className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold">
              Filtreyi temizle
            </button>
          )}
        </div>
      </div>

      {loading && <div className="h-56 animate-pulse rounded-3xl bg-slate-100" />}
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      {!loading && !error && filteredEvents.length === 0 && (
        <EmptyState
          title={events.length === 0 ? "Etkinlik bulunamadı" : "Sonuç bulunamadı"}
          subtitle={events.length === 0 ? "Keşfedilecek etkinlikler burada görünecek." : "Arama veya filtrelerini değiştir."}
          icon="🔎"
          action={events.length > 0 ? <button type="button" onClick={clearFilters} className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Filtreyi temizle</button> : null}
        />
      )}

      {filteredEvents.length > 0 && (
        <ul className="grid gap-5 md:grid-cols-2">
          {filteredEvents.map((event) => (
            <li key={event.id}>
              <EventCard {...event} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
