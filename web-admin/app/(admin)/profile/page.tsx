"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  query,
  QuerySnapshot,
  Timestamp,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { clubLabelFromData, getClub } from "../../../lib/clubRepo";
import { COL } from "../../../lib/collections";
import { getMergedUserRecord, type MergedUserRecord } from "../../../lib/userRecord";
import { syncCheckinBadges } from "../../../lib/badgeAward";
import { formatProfileDate, pickString, resolveEventTitle } from "../../../lib/profileData";
import { normalizeAppRole, roleLabelTr } from "../../../lib/role";
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Chip } from "../../components/ui/chip";
import { BadgeShowcase } from "../../components/BadgeGrid";
import { PointsProgressBar } from "../../components/PointsProgressBar";
import { BADGE_ORDER, splitBadgeSections } from "../../shared/badges";

type UserRecord = Record<string, unknown>;
type CheckinItem = { id: string; eventId: string; eventTitle?: string; checkinAt?: Timestamp };
type RsvpItem = { id: string; eventId: string; eventTitle?: string; createdAt?: Timestamp };
type MemberClub = { id: string; name: string };

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<MergedUserRecord | null>(null);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [rsvps, setRsvps] = useState<RsvpItem[]>([]);
  const [memberClubs, setMemberClubs] = useState<MemberClub[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    syncCheckinBadges(user.uid).catch(() => {
      // Profil rozet senkronu başarısız olsa sayfa açılsın.
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMergedUserRecord(user.uid)
      .then((record) => {
        if (!cancelled) {
          setProfile(record);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Profil verisi alınamadı.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const docsById = new Map<string, CheckinItem>();

    const apply = async (snapshot: QuerySnapshot) => {
      for (const docItem of snapshot.docs) {
        const data = docItem.data() as UserRecord;
        const eventId =
          pickString(data, ["eventId", "EtkinlikId", "etkinlikId"]) || docItem.id.split("_")[0];
        docsById.set(docItem.id, {
          id: docItem.id,
          eventId,
          eventTitle: await resolveEventTitle(eventId),
          checkinAt: data.checkinAt as Timestamp | undefined,
        });
      }
      const merged = Array.from(docsById.values())
        .sort((a, b) => (b.checkinAt?.toMillis() ?? 0) - (a.checkinAt?.toMillis() ?? 0))
        .slice(0, 20);
      setCheckins(merged);
    };

    const onError = (snapshotError: Error) => {
      setError(snapshotError.message);
    };

    const stopPrimary = onSnapshot(
      query(collection(db, COL.checkins), where("uid", "==", user.uid), limit(20)),
      apply,
      onError
    );

    const stopLegacy = onSnapshot(
      query(collection(db, COL.checkinsLegacy), where("uid", "==", user.uid), limit(20)),
      apply,
      () => {
        // Legacy field name fallback.
      }
    );

    return () => {
      stopPrimary();
      stopLegacy();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const handleRsvps = async (snapshot: QuerySnapshot) => {
      const items = await Promise.all(
        snapshot.docs.map(async (rsvpDoc) => {
          const data = rsvpDoc.data() as UserRecord;
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
    };

    const stop = onSnapshot(
      query(collection(db, COL.rsvps), where("uid", "==", user.uid)),
      handleRsvps,
      () => {
        // Ignore RSVP listener errors.
      }
    );

    return stop;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadClubs = async (snapshot: QuerySnapshot) => {
      const ids = snapshot.docs
        .map((docItem) => {
          const data = docItem.data() as UserRecord;
          return pickString(data, ["clubId", "kulupId"]);
        })
        .filter(Boolean);
      const uniqueIds = Array.from(new Set(ids));
      const clubs = await Promise.all(
        uniqueIds.map(async (clubId) => {
          const club = await getClub(clubId);
          if (!club) {
            return { id: clubId, name: clubId };
          }
          return {
            id: clubId,
            name: clubLabelFromData(club.data, clubId),
          };
        })
      );
      setMemberClubs(clubs);
    };

    const stopMembership = onSnapshot(
      query(collection(db, COL.clubMembers), where("uid", "==", user.uid)),
      loadClubs,
      (snapshotError) => setError(snapshotError.message)
    );

    return stopMembership;
  }, [user]);

  const email = profile?.email || user?.email || "-";
  const role = normalizeAppRole(profile?.role);
  const clubId = profile?.clubId ?? "";
  const banned = profile?.banned === true;
  const points = profile?.points ?? 0;
  const badges = profile?.badges ?? [];
  const { earned } = splitBadgeSections(badges);
  const isStaff = role === "admin" || role === "club_manager";

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
      router.replace("/auth");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Çıkış yapılamadı.");
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return <p>Yükleniyor...</p>;
  }

  if (!user) {
    return <p>Oturum bulunamadı.</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Profil</h1>
          <p className="mt-2 text-sm text-text2">Hesap, puan, rozet ve katılım bilgileri.</p>
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
          <PointsProgressBar points={points} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip className={banned ? "border-danger/50 bg-danger/10 text-danger" : ""}>
              {banned ? "Banlı" : "Aktif"}
            </Chip>
            {clubId ? <Chip>Kulüp: {clubId}</Chip> : null}
          </div>
        </div>
      </Card>

      {isStaff && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Yönetim</h2>
          <p className="mt-1 text-sm text-text2">Kulüp üyelik başvurularını ve kulüp ayarlarını yönet.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/club">
              <Button type="button">Kulübüm / Üyelik Yönetimi</Button>
            </Link>
            <Link href="/events">
              <Button type="button" variant="secondary">
                Etkinlik Yönetimi
              </Button>
            </Link>
            {role === "admin" && (
              <>
                <Link href="/admin/users">
                  <Button type="button" variant="secondary">
                    Kullanıcılar
                  </Button>
                </Link>
                <Link href="/admin/managers">
                  <Button type="button" variant="secondary">
                    Yöneticiler
                  </Button>
                </Link>
              </>
            )}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Rozetler</h2>
            <p className="mt-1 text-sm text-text2">
              {earned.length} kazanıldı · {BADGE_ORDER.length - earned.length} kilitli
            </p>
          </div>
        </div>
        <BadgeShowcase badges={badges} />
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Üye olduğum kulüpler</h2>
        {memberClubs.length === 0 ? (
          <p className="mt-3 text-sm text-text2">Kulüp üyeliği bulunamadı.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {memberClubs.map((club) => (
              <Link key={club.id} href={`/clubs/${club.id}`}>
                <Chip>{club.name}</Chip>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Katılacağım Etkinliklerim</h2>
        {rsvps.length === 0 ? (
          <p className="mt-3 text-sm text-text2">Henüz RSVP kaydı yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rsvps.map((rsvp) => (
              <li key={rsvp.id} className="rounded-xl border border-border bg-surface2 px-3 py-2">
                <p className="font-medium">{rsvp.eventTitle ?? rsvp.eventId}</p>
                <p className="text-sm text-text2">{formatProfileDate(rsvp.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Katılım Geçmişi</h2>
        {checkins.length === 0 ? (
          <p className="mt-3 text-sm text-text2">Katılım kaydı bulunamadı.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {checkins.map((checkin) => (
              <li key={checkin.id} className="rounded-xl border border-border bg-surface2 px-3 py-2">
                <p className="font-medium">{checkin.eventTitle ?? checkin.eventId}</p>
                <p className="text-sm text-text2">{formatProfileDate(checkin.checkinAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {error && <p className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
