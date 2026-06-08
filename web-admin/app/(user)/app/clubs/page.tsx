"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import { EmptyState } from "../../../components/EmptyState";
import { ClubCard } from "../../../components/ClubCard";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { COL } from "../../../../lib/collections";
import {
  pickClubBio,
  pickClubHandle,
  pickClubLogoKey,
  pickClubName,
  pickClubTags,
} from "../../../../lib/clubFields";
import { db } from "../../../../lib/firebase";

type ClubItem = {
  id: string;
  name: string;
  bio: string;
  handle: string;
  tags: string[];
  logoKey: string;
};

const popularTags = [
  "arduino",
  "robotik",
  "tiyatro",
  "konser",
  "turnuva",
  "bağış",
  "yazılım",
  "sergi",
];

function mapClubDocs(snapshot: QuerySnapshot<DocumentData>): ClubItem[] {
  return snapshot.docs
    .map((clubDoc) => {
      const data = clubDoc.data() as Record<string, unknown>;
      const name = pickClubName(data, clubDoc.id);
      return {
        id: clubDoc.id,
        name,
        bio: pickClubBio(data),
        handle: pickClubHandle(data, clubDoc.id, name),
        tags: pickClubTags(data),
        logoKey: pickClubLogoKey(data),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export default function StudentClubsPage() {
  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COL.clubs),
      (snapshot) => {
        setClubs(mapClubDocs(snapshot));
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error("clubs snapshot error:", snapshotError);
        setError(snapshotError.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const tagOptions = useMemo(() => {
    const fromClubs = clubs.flatMap((club) => club.tags);
    const merged = new Set([...popularTags, ...fromClubs]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b, "tr"));
  }, [clubs]);

  const filteredClubs = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    return clubs.filter((club) => {
      const searchable = [club.name, club.handle, club.bio, ...club.tags].join(" ").toLowerCase();
      const matchesSearch = !queryText || searchable.includes(queryText);
      const matchesTag =
        selectedTag == null ||
        club.tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase());
      return matchesSearch && matchesTag;
    });
  }, [clubs, searchQuery, selectedTag]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTag(null);
  };

  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Öğrenci Paneli</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">Kulüpler</h1>
        <p className="mt-2 text-sm text-text2">
          Kulüpleri keşfet, detaylarına bak ve üye olmak için başvuru gönder.
        </p>
      </div>

      <Card className="mb-6 p-4">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Kulüp adı, @handle veya etiket ara"
          className="ui-input"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {tagOptions.map((tag) => (
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
          {(searchQuery || selectedTag) && (
            <Button type="button" onClick={clearFilters} variant="secondary" className="min-h-8 rounded-full px-3 text-sm">
              Filtreyi temizle
            </Button>
          )}
        </div>
      </Card>

      {loading && <div className="h-48 animate-pulse rounded-3xl bg-surface2" />}

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {!loading && !error && filteredClubs.length === 0 && (
        <EmptyState
          icon="🏛️"
          title={clubs.length === 0 ? "Henüz kulüp yok" : "Sonuç bulunamadı"}
          subtitle={
            clubs.length === 0
              ? "Onaylanan kulüpler burada listelenecek."
              : "Arama veya etiket filtresini değiştir."
          }
          action={
            clubs.length > 0 ? (
              <Button type="button" onClick={clearFilters}>
                Filtreyi temizle
              </Button>
            ) : null
          }
        />
      )}

      {filteredClubs.length > 0 && (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClubs.map((club) => (
            <li key={club.id} className="h-full">
              <ClubCard {...club} detailPathPrefix="/app/clubs" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
