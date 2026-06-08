"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  query,
  QuerySnapshot,
  Timestamp,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { EmptyState } from "../../../components/EmptyState";
import { BadgeShowcase } from "../../../components/BadgeGrid";
import { PointsProgressBar } from "../../../components/PointsProgressBar";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Chip } from "../../../components/ui/chip";
import { BADGE_ORDER, getBadgeDefinition, pickBadgeArray, splitBadgeSections } from "../../../shared/badges";
import { auth, db } from "../../../../lib/firebase";
import { COL } from "../../../../lib/collections";
import { syncCheckinBadges } from "../../../../lib/badgeAward";
import { clubLabelFromData, getClub } from "../../../../lib/clubRepo";
import { formatProfileDate, pickString, resolveEventTitle } from "../../../../lib/profileData";
import { normalizeAppRole, roleLabelTr } from "../../../../lib/role";

type BadgeItem = {
  id: string;
  title?: string;
  earnedAt?: Timestamp;
};

type CheckinItem = {
  id: string;
  eventId?: string;
  eventTitle?: string;
  checkinAt?: Timestamp;
};

type RsvpItem = {
  id: string;
  eventId: string;
  eventTitle?: string;
  createdAt?: Timestamp;
};

type MemberClub = { id: string; name: string };

function parseBadges(value: unknown): BadgeItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const badges: BadgeItem[] = [];
  for (const item of value) {
    const data = item as Record<string, unknown>;
    const id = String(data.id ?? data.badgeId ?? data.title ?? "BADGE");
    if (seen.has(id)) continue;
    seen.add(id);
    badges.push({
      id,
      title: getBadgeDefinition(id)?.title ?? pickString(data, ["title", "name", "ad", "Ad"]) ?? id,
      earnedAt: data.earnedAt as Timestamp | undefined,
    });
  }
  return badges;
}

export default function UserProfilePage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState("-");
  const [role, setRole] = useState("student");
  const [points, setPoints] = useState(0);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [rsvps, setRsvps] = useState<RsvpItem[]>([]);
  const [memberClubs, setMemberClubs] = useState<MemberClub[]>([]);
  const [loadingCheckins, setLoadingCheckins] = useState(true);
  const [loadingRsvps, setLoadingRsvps] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setEmail(user?.email ?? "-");
      if (!user) {
        router.replace("/auth");
      }
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!uid) return;
    syncCheckinBadges(uid).catch(() => {
      // Rozet senkronu başarısız olsa profil yine açılsın.
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const stop = onSnapshot(
      doc(db, COL.users, uid),
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
        setRole(normalizeAppRole(data.role));
        setPoints(Number(data.pointsTotal ?? data.points ?? data.Puan ?? data.puan ?? 0));
        setBadges(parseBadges(pickBadgeArray(data)));
        if (!email || email === "-") {
          const storedEmail = pickString(data, ["email", "e-posta", "Email"]);
          if (storedEmail) setEmail(storedEmail);
        }
      },
      () => {
        // Ignore listener errors.
      }
    );
    return stop;
  }, [email, uid]);

  useEffect(() => {
    if (!uid) return;

    const handleSnapshot = async (snapshot: QuerySnapshot<DocumentData>) => {
      const items = await Promise.all(
        snapshot.docs.map(async (checkinDoc) => {
          const data = checkinDoc.data() as Record<string, unknown>;
          const eventId = pickString(data, ["eventId", "EtkinlikId", "etkinlikId"]) ?? checkinDoc.id.split("_")[0];
          return {
            id: checkinDoc.id,
            eventId,
            eventTitle: await resolveEventTitle(eventId),
            checkinAt: data.checkinAt as Timestamp | undefined,
          };
        })
      );
      setCheckins(items);
      setLoadingCheckins(false);
    };

    const noop = () => setLoadingCheckins(false);

    const primaryQuery = query(collection(db, COL.checkins), where("uid", "==", uid));
    let fallbackStop: (() => void) | null = null;
    const stop = onSnapshot(
      primaryQuery,
      (snapshot) => {
        if (snapshot.empty) {
          fallbackStop = onSnapshot(
            query(collection(db, COL.checkinsLegacy), where("uid", "==", uid)),
            handleSnapshot,
            noop
          );
          return;
        }
        handleSnapshot(snapshot);
      },
      () => {
        fallbackStop = onSnapshot(
          query(collection(db, COL.checkinsLegacy), where("UID", "==", uid)),
          handleSnapshot,
          noop
        );
      }
    );

    return () => {
      stop();
      fallbackStop?.();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const handleRsvps = async (snapshot: QuerySnapshot<DocumentData>) => {
      const items = await Promise.all(
        snapshot.docs.map(async (rsvpDoc) => {
          const data = rsvpDoc.data() as Record<string, unknown>;
          const eventId =
            pickString(data, ["eventId", "EtkinlikId", "etkinlikId"]) ??
            rsvpDoc.id.split("_")[0];
          return {
            id: rsvpDoc.id,
            eventId,
            eventTitle: await resolveEventTitle(eventId),
            createdAt: data.createdAt as Timestamp | undefined,
          };
        })
      );
      setRsvps(items);
      setLoadingRsvps(false);
    };

    const stop = onSnapshot(
      query(collection(db, COL.rsvps), where("uid", "==", uid)),
      handleRsvps,
      () => setLoadingRsvps(false)
    );

    return stop;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const loadClubs = async (snapshot: QuerySnapshot<DocumentData>) => {
      const ids = snapshot.docs
        .map((docItem) => {
          const data = docItem.data() as Record<string, unknown>;
          return pickString(data, ["clubId", "kulupId"]);
        })
        .filter(Boolean);
      const uniqueIds = Array.from(new Set(ids));
      const clubs = await Promise.all(
        uniqueIds.map(async (clubId) => {
          const club = await getClub(clubId);
          if (!club) return { id: clubId, name: clubId };
          return { id: clubId, name: clubLabelFromData(club.data, clubId) };
        })
      );
      setMemberClubs(clubs);
    };

    const stopMembership = onSnapshot(
      query(collection(db, COL.clubMembers), where("uid", "==", uid)),
      loadClubs,
      () => {
        // Ignore membership listener errors.
      }
    );

    return stopMembership;
  }, [uid]);

  const { earned } = useMemo(() => splitBadgeSections(badges), [badges]);
  const latestBadge = useMemo(() => earned[earned.length - 1], [earned]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
      router.replace("/auth");
    } finally {
      setSigningOut(false);
    }
  };

  if (!uid) {
    return <p>Yükleniyor...</p>;
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand">Profil</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Katılım profilin</h1>
          <p className="mt-2 text-sm text-text2">Puanlarını, rozetlerini ve kulüp üyeliklerini takip et.</p>
        </div>
        <Button onClick={handleSignOut} disabled={signingOut} variant="secondary">
          {signingOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border bg-gradient-to-br from-brand/20 via-surface2 to-surface p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-surface2 text-2xl font-semibold text-brand">
              {(email[0] ?? "?").toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{email}</h2>
              <p className="mt-1 text-sm text-text2">{roleLabelTr(role)}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-text2">Toplam puan</p>
              <p className="mt-2 text-3xl font-semibold text-text">{points}</p>
            </div>
            <div>
              <p className="text-sm text-text2">Kazanılan rozet</p>
              <p className="mt-2 text-3xl font-semibold text-text">{earned.length}</p>
            </div>
            <div>
              <p className="text-sm text-text2">Son rozet</p>
              <p className="mt-2 text-lg font-semibold text-text">
                {latestBadge?.definition.title ?? "-"}
              </p>
            </div>
          </div>
          <PointsProgressBar points={points} />
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Rozetler</h2>
            <p className="mt-1 text-sm text-text2">
              {earned.length} kazanıldı · {BADGE_ORDER.length - earned.length} kilitli
            </p>
          </div>
        </div>
        <BadgeShowcase badges={badges} />
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-semibold">Üye olduğum kulüpler</h2>
        {memberClubs.length === 0 ? (
          <p className="mt-3 text-sm text-text2">
            Henüz kulüp üyeliğin yok.{" "}
            <Link href="/app/clubs" className="text-brand underline">
              Kulüplere göz at
            </Link>
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {memberClubs.map((club) => (
              <Link key={club.id} href={`/app/clubs/${club.id}`}>
                <Chip>{club.name}</Chip>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Katılacağım Etkinliklerim</h2>
        {loadingRsvps && <div className="h-24 animate-pulse rounded-3xl bg-surface2" />}
        {!loadingRsvps && rsvps.length === 0 && (
          <EmptyState title="Henüz RSVP yok" subtitle="Etkinliklere katılım kaydı oluşturduğunda burada görünecek." icon="📅" />
        )}
        {rsvps.length > 0 && (
          <ul className="divide-y divide-border rounded-3xl border border-border bg-surface px-5 shadow-sm">
            {rsvps.map((rsvp) => (
              <li key={rsvp.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{rsvp.eventTitle}</p>
                  <p className="text-sm text-text2">{rsvp.eventId}</p>
                </div>
                <p className="text-sm text-text2">{formatProfileDate(rsvp.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Katılım Geçmişi</h2>
        {loadingCheckins && <div className="h-40 animate-pulse rounded-3xl bg-surface2" />}
        {!loadingCheckins && checkins.length === 0 && (
          <EmptyState title="Henüz check-in yok" subtitle="Etkinliklere katıldığında geçmişin burada görünecek." icon="📍" />
        )}
        {checkins.length > 0 && (
          <ul className="divide-y divide-border rounded-3xl border border-border bg-surface px-5 shadow-sm">
            {checkins.map((checkin) => (
              <li key={checkin.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{checkin.eventTitle}</p>
                  <p className="text-sm text-text2">{checkin.eventId}</p>
                </div>
                <p className="text-sm text-text2">{formatProfileDate(checkin.checkinAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
