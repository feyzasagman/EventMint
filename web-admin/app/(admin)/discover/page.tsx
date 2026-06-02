"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, DocumentData, onSnapshot, orderBy, query, QuerySnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { EmptyState } from "../../components/EmptyState";
import { EventCard } from "../../components/EventCard";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { auth, db } from "../../../lib/firebase";

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
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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

export default function DiscoverPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tümü");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    let stopEventsListener: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && !isDemoMode) {
        router.replace("/login");
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
              createdAt: data.createdAt as EventItem["createdAt"],
            };
          })
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setEvents(items);
        setLoading(false);
      };

      stopEventsListener = onSnapshot(
        query(collection(db, "events"), orderBy("createdAt", "desc")),
        handleSnapshot,
        (snapshotError) => {
          console.warn("Falling back to unordered discover query:", snapshotError);
          stopEventsListener?.();
          stopEventsListener = onSnapshot(
            collection(db, "events"),
            handleSnapshot,
            (fallbackError) => {
              setError(fallbackError.message);
              setLoading(false);
            }
          );
        }
      );
    });

    return () => {
      unsubscribe();
      stopEventsListener?.();
    };
  }, [router]);

  const filteredEvents = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      const searchable = [
        event.title,
        event.clubId,
        event.category,
        event.location,
        ...(event.tags ?? []),
      ].filter(Boolean).join(" ").toLowerCase();
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
      <Card className="mb-6 p-4">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Etkinlik, kulüp, kategori, konum veya etiket ara"
          className="ui-input"
        />
        <div className="mt-4 flex flex-wrap gap-2">
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
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              variant={selectedTag === tag ? "brand" : "secondary"}
              className="min-h-8 rounded-full px-3 text-sm"
            >
              {tag}
            </Button>
          ))}
          {(searchQuery || selectedCategory !== "Tümü" || selectedTag) && (
            <Button
              type="button"
              onClick={clearFilters}
              variant="secondary"
              className="min-h-8 rounded-full px-3 text-sm"
            >
              Filtreyi temizle
            </Button>
          )}
        </div>
      </Card>

      {loading && <div className="h-48 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-900" />}
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      {!loading && !error && filteredEvents.length === 0 && (
        <EmptyState
          icon="🔎"
          title={events.length === 0 ? "Etkinlik bulunamadı" : "Sonuç bulunamadı"}
          subtitle={events.length === 0 ? "Keşfedilecek etkinlikler burada görünecek." : "Arama veya filtrelerini değiştir."}
          action={events.length > 0 ? (
            <Button
              type="button"
              onClick={clearFilters}
            >
              Filtreyi temizle
            </Button>
          ) : null}
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
