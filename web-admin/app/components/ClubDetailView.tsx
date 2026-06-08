"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { ClubHeroHeader } from "../components/ClubHeroHeader";
import { ClubMembershipAction } from "../components/ClubMembershipAction";
import { ClubPostFeedCard } from "../components/ClubPostFeedCard";
import { EventCard } from "../components/EventCard";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Chip } from "../components/ui/chip";
import { COL } from "../../lib/collections";
import {
  pickClubBio,
  pickClubCoverUrl,
  pickClubHandle,
  pickClubLogoKey,
  pickClubName,
  pickClubTags,
  pickPostHashtags,
  pickPostText,
  pickString,
  formatFirestoreDate,
} from "../../lib/clubFields";
import { db } from "../../lib/firebase";

type TabId = "about" | "events" | "posts";

function formatDateLabel(value: Date | null) {
  if (!value) return "";
  const day = value.getDate().toString().padStart(2, "0");
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const hour = value.getHours().toString().padStart(2, "0");
  const minute = value.getMinutes().toString().padStart(2, "0");
  return `${day}.${month}.${value.getFullYear()} ${hour}:${minute}`;
}

export function ClubDetailView({ clubId }: { clubId: string }) {
  const [clubData, setClubData] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<
    Array<{ id: string; title?: string; clubId?: string; category?: string; location?: string; tags?: string[] }>
  >([]);
  const [posts, setPosts] = useState<
    Array<{ id: string; text: string; hashtags: string[]; createdAtLabel: string }>
  >([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("about");

  useEffect(() => {
    if (!clubId) return;

    const stopClub = onSnapshot(
      doc(db, COL.clubs, clubId),
      (snapshot) => {
        setClubData(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null);
        setLoading(false);
        setError(snapshot.exists() ? null : "Kulüp bulunamadı.");
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );

    const stopEvents = onSnapshot(
      query(collection(db, COL.events), where("clubId", "==", clubId), where("status", "==", "published")),
      (snapshot) => {
        setEvents(
          snapshot.docs.map((eventDoc) => {
            const data = eventDoc.data() as DocumentData;
            return {
              id: eventDoc.id,
              title: pickString(data, ["title", "Baslik", "baslik"]),
              clubId,
              category: pickString(data, ["category", "Kategori", "kategori"]),
              location: pickString(data, ["location", "Konum", "konum"]),
              tags: pickClubTags(data),
            };
          })
        );
      }
    );

    const stopPosts = onSnapshot(
      query(collection(db, COL.clubPosts), where("clubId", "==", clubId)),
      (snapshot) => {
        const items = snapshot.docs
          .map((postDoc) => {
            const data = postDoc.data() as DocumentData;
            return {
              id: postDoc.id,
              text: pickPostText(data),
              hashtags: pickPostHashtags(data),
              createdAt: formatFirestoreDate(data.createdAt ?? data.olusturulduAt),
            };
          })
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

        setPosts(
          items.map((item) => ({
            id: item.id,
            text: item.text,
            hashtags: item.hashtags,
            createdAtLabel: formatDateLabel(item.createdAt),
          }))
        );
      }
    );

    const stopMembers = onSnapshot(
      query(collection(db, COL.clubMembers), where("clubId", "==", clubId)),
      (snapshot) => setMemberCount(snapshot.size)
    );

    return () => {
      stopClub();
      stopEvents();
      stopPosts();
      stopMembers();
    };
  }, [clubId]);

  const clubName = useMemo(
    () => (clubData ? pickClubName(clubData, clubId) : clubId),
    [clubData, clubId]
  );

  if (loading) {
    return <div className="h-56 animate-pulse rounded-2xl bg-surface2" />;
  }

  if (error || !clubData) {
    return (
      <Card className="p-6">
        <p className="text-sm text-danger">{error ?? "Kulüp bulunamadı."}</p>
      </Card>
    );
  }

  const handle = pickClubHandle(clubData, clubId, clubName);
  const bio = pickClubBio(clubData);
  const tags = pickClubTags(clubData);
  const logoKey = pickClubLogoKey(clubData);
  const logoUrl = pickString(clubData, ["logoUrl", "logo"]);
  const coverUrl = pickClubCoverUrl(clubData);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "about", label: "Hakkında" },
    { id: "events", label: "Etkinlikler" },
    { id: "posts", label: "Paylaşımlar" },
  ];

  return (
    <div className="-mx-5 -mt-8 md:-mx-0 md:mt-0">
      <ClubHeroHeader
        name={clubName}
        handle={handle}
        bio={bio}
        logoKey={logoKey}
        logoUrl={logoUrl}
        coverUrl={coverUrl}
        actions={<ClubMembershipAction clubId={clubId} />}
        meta={
          <p className="text-sm font-semibold text-text2">
            Üye: {memberCount} • Etkinlik: {events.length}
          </p>
        }
      />

      <div className="sticky top-[73px] z-10 border-b border-border bg-bg/95 px-5 backdrop-blur md:px-0">
        <div className="flex gap-1 overflow-x-auto py-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={activeTab === tab.id ? "brand" : "secondary"}
              className="min-h-9 shrink-0 rounded-full px-4 text-sm"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-5 py-6 md:px-0">
        {activeTab === "about" && (
          <Card className="p-5">
            <h2 className="text-sm font-bold text-text">Hakkında</h2>
            <p className="mt-3 text-sm leading-6 text-text2">{bio || "Bio eklenmemiş."}</p>
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Chip key={tag}>{tag}</Chip>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === "events" && (
          <>
            {events.length === 0 ? (
              <Card className="p-5 text-sm text-text2">Yayınlanmış etkinlik yok.</Card>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {events.map((event) => (
                  <li key={event.id}>
                    <EventCard {...event} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {activeTab === "posts" && (
          <>
            {posts.length === 0 ? (
              <Card className="p-5 text-sm text-text2">Henüz paylaşım yok.</Card>
            ) : (
              <ul className="space-y-4">
                {posts.map((post) => (
                  <li key={post.id}>
                    <ClubPostFeedCard
                      clubId={clubId}
                      clubName={clubName}
                      text={post.text}
                      hashtags={post.hashtags}
                      createdAtLabel={post.createdAtLabel}
                      logoKey={logoKey}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
