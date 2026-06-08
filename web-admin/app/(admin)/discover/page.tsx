"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ClubPostFeedCard } from "../../components/ClubPostFeedCard";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { COL } from "../../../lib/collections";
import {
  formatFirestoreDate,
  pickClubLogoKey,
  pickClubName,
  pickPostHashtags,
  pickPostText,
  pickString,
} from "../../../lib/clubFields";
import { auth, db } from "../../../lib/firebase";

type ClubOption = {
  id: string;
  name: string;
  logoKey: string;
  logoUrl: string;
};

type PostItem = {
  id: string;
  clubId: string;
  clubName: string;
  text: string;
  hashtags: string[];
  createdAt: Date | null;
};

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function formatDateLabel(value: Date | null) {
  if (!value) return "";
  const day = value.getDate().toString().padStart(2, "0");
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const hour = value.getHours().toString().padStart(2, "0");
  const minute = value.getMinutes().toString().padStart(2, "0");
  return `${day}.${month}.${value.getFullYear()} ${hour}:${minute}`;
}

function mapPostDocs(snapshot: QuerySnapshot<DocumentData>): PostItem[] {
  return snapshot.docs.map((postDoc) => {
    const data = postDoc.data() as Record<string, unknown>;
    const clubId = pickString(data, ["clubId", "kulupId", "kulupID"]);
    const clubName = pickString(data, ["clubName", "name", "ad", "Reklam"]);
    return {
      id: postDoc.id,
      clubId,
      clubName,
      text: pickPostText(data),
      hashtags: pickPostHashtags(data),
      createdAt: formatFirestoreDate(data.createdAt ?? data.olusturulduAt),
    };
  });
}

export default function DiscoverPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [clubMeta, setClubMeta] = useState<Record<string, ClubOption>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indexNote, setIndexNote] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");

  useEffect(() => {
    let stopPostsListener: (() => void) | null = null;
    let stopClubsListener: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && !isDemoMode) {
        router.replace("/login");
        return;
      }

      stopClubsListener = onSnapshot(
        collection(db, COL.clubs),
        (snapshot) => {
          const items = snapshot.docs.map((clubDoc) => {
            const data = clubDoc.data() as Record<string, unknown>;
            const name = pickClubName(data, clubDoc.id);
            const logoUrl = pickString(data, ["logoUrl", "logo"]);
            const logoKey = pickClubLogoKey(data);
            return { id: clubDoc.id, name, logoKey, logoUrl };
          });
          items.sort((a, b) => a.name.localeCompare(b.name, "tr"));
          setClubs(items);
          setClubMeta(Object.fromEntries(items.map((club) => [club.id, club])));
        },
        (clubError) => {
          console.error("clubs snapshot error:", clubError);
        }
      );

      const handlePostsSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
        const items = mapPostDocs(snapshot).sort((a, b) => {
          const aMs = a.createdAt?.getTime() ?? 0;
          const bMs = b.createdAt?.getTime() ?? 0;
          return bMs - aMs;
        });
        setPosts(items.slice(0, 30));
        setLoading(false);
        setError(null);
      };

      // Firestore: club_posts için createdAt alanında tek alanlı index yeterli.
      // where + orderBy birlikte kullanılırsa composite index gerekir.
      stopPostsListener = onSnapshot(
        query(
          collection(db, COL.clubPosts),
          orderBy("createdAt", "desc"),
          limit(30)
        ),
        handlePostsSnapshot,
        (snapshotError) => {
          console.warn(
            "club_posts ordered query failed, falling back:",
            snapshotError
          );
          setIndexNote(
            "createdAt sıralaması için Firestore index gerekebilir; geçici olarak client-side sıralama kullanılıyor."
          );
          stopPostsListener?.();
          stopPostsListener = onSnapshot(
            collection(db, COL.clubPosts),
            (fallbackSnapshot) => {
              handlePostsSnapshot(fallbackSnapshot);
            },
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
      stopPostsListener?.();
      stopClubsListener?.();
    };
  }, [router]);

  useEffect(() => {
    const missingClubIds = [
      ...new Set(
        posts
          .filter((post) => post.clubId && !post.clubName && !clubMeta[post.clubId])
          .map((post) => post.clubId)
      ),
    ];
    if (missingClubIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      const fetched = await Promise.all(
        missingClubIds.map(async (clubId) => {
          const snapshot = await getDoc(doc(db, COL.clubs, clubId));
          if (!snapshot.exists()) return null;
          const data = snapshot.data() as Record<string, unknown>;
          return {
            id: clubId,
            name: pickClubName(data, clubId),
            logoKey: pickClubLogoKey(data),
            logoUrl: pickString(data, ["logoUrl", "logo"]),
          } satisfies ClubOption;
        })
      );

      if (cancelled) return;
      const valid = fetched.filter((club): club is ClubOption => club != null);
      if (valid.length === 0) return;

      setClubMeta((prev) => ({
        ...prev,
        ...Object.fromEntries(valid.map((club) => [club.id, club])),
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [posts, clubMeta]);

  const enrichedPosts = useMemo(() => {
    return posts.map((post) => {
      const meta = clubMeta[post.clubId];
      return {
        ...post,
        clubName: post.clubName || meta?.name || post.clubId || "Kulüp",
        logoKey: meta?.logoKey,
        logoUrl: meta?.logoUrl,
      };
    });
  }, [posts, clubMeta]);

  const filteredPosts = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    return enrichedPosts.filter((post) => {
      const matchesClub =
        !selectedClubId || post.clubId === selectedClubId;
      const matchesSearch =
        !queryText ||
        post.text.toLowerCase().includes(queryText) ||
        post.clubName.toLowerCase().includes(queryText) ||
        post.hashtags.some((tag) => tag.toLowerCase().includes(queryText));
      return matchesClub && matchesSearch;
    });
  }, [enrichedPosts, searchQuery, selectedClubId]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedClubId("");
  };

  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-brand">
          Feed
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Keşfet</h1>
        <p className="mt-2 max-w-2xl text-sm text-text2">
          Kulüp paylaşımlarını takip et, metin içinde ara ve kulübe göre filtrele.
        </p>
      </div>

      <Card className="mb-6 space-y-4 p-4">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Paylaşım metninde ara..."
          className="ui-input"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-text2">
            Kulüp filtresi
            <select
              value={selectedClubId}
              onChange={(event) => setSelectedClubId(event.target.value)}
              className="ui-input"
            >
              <option value="">Tüm kulüpler</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
          {(searchQuery || selectedClubId) && (
            <Button
              type="button"
              onClick={clearFilters}
              variant="secondary"
              className="sm:self-end"
            >
              Filtreyi temizle
            </Button>
          )}
        </div>
        {indexNote && (
          <p className="text-xs text-text2">{indexNote}</p>
        )}
      </Card>

      {loading && (
        <div className="h-48 animate-pulse rounded-[16px] bg-surface2" />
      )}

      {error && (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && !error && filteredPosts.length === 0 && (
        <EmptyState
          icon="🔎"
          title={posts.length === 0 ? "Henüz paylaşım yok" : "Sonuç bulunamadı"}
          subtitle={
            posts.length === 0
              ? "Kulüp paylaşımları burada görünecek."
              : "Arama veya kulüp filtresini değiştir."
          }
          action={
            posts.length > 0 ? (
              <Button type="button" onClick={clearFilters}>
                Filtreyi temizle
              </Button>
            ) : null
          }
        />
      )}

      {filteredPosts.length > 0 && (
        <ul className="space-y-4">
          {filteredPosts.map((post) => (
            <li key={post.id}>
              <ClubPostFeedCard
                clubId={post.clubId}
                clubName={post.clubName}
                logoKey={post.logoKey}
                logoUrl={post.logoUrl}
                text={post.text}
                hashtags={post.hashtags}
                createdAtLabel={formatDateLabel(post.createdAt)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
