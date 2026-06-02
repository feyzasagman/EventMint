"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { getMergedUserRecord, type MergedUserRecord } from "../../../lib/userRecord";
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Chip } from "../../components/ui/chip";

type UserRecord = Record<string, unknown>;
type CheckinItem = { id: string; eventId: string; checkinAt?: Timestamp };
type MemberClub = { id: string; name: string };

function pickString(data: UserRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function formatDate(value?: Timestamp) {
  return value?.toDate().toLocaleString("tr-TR") ?? "-";
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<MergedUserRecord | null>(null);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
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

    const apply = () => {
      const merged = Array.from(docsById.values())
        .sort((a, b) => (b.checkinAt?.toMillis() ?? 0) - (a.checkinAt?.toMillis() ?? 0))
        .slice(0, 20);
      setCheckins(merged);
    };

    const stopUpper = onSnapshot(
      query(collection(db, "Check-in"), where("UID", "==", user.uid), limit(20)),
      (snapshot) => {
        for (const docItem of snapshot.docs) {
          const data = docItem.data() as UserRecord;
          docsById.set(docItem.id, {
            id: docItem.id,
            eventId: pickString(data, ["eventId", "EtkinlikId", "etkinlikId"]) || docItem.id,
            checkinAt: data.checkinAt as Timestamp | undefined,
          });
        }
        apply();
      }
    );

    const stopLower = onSnapshot(
      query(collection(db, "Check-in"), where("uid", "==", user.uid), limit(20)),
      (snapshot) => {
        for (const docItem of snapshot.docs) {
          const data = docItem.data() as UserRecord;
          docsById.set(docItem.id, {
            id: docItem.id,
            eventId: pickString(data, ["eventId", "EtkinlikId", "etkinlikId"]) || docItem.id,
            checkinAt: data.checkinAt as Timestamp | undefined,
          });
        }
        apply();
      }
    );

    return () => {
      stopUpper();
      stopLower();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const stopMembership = onSnapshot(
      query(collection(db, "KulüpÜyeleri"), where("UID", "==", user.uid)),
      async (snapshot) => {
        const ids = snapshot.docs
          .map((docItem) => {
            const data = docItem.data() as UserRecord;
            return pickString(data, ["kulupId", "clubId"]);
          })
          .filter(Boolean);
        const uniqueIds = Array.from(new Set(ids));
        const clubs = await Promise.all(
          uniqueIds.map(async (clubId) => {
            const clubSnapshot = await getDoc(doc(db, "Kulüpler", clubId));
            if (!clubSnapshot.exists()) {
              return { id: clubId, name: clubId };
            }
            const data = clubSnapshot.data() as UserRecord;
            return { id: clubId, name: pickString(data, ["ad", "Reklam", "name"]) || clubId };
          })
        );
        setMemberClubs(clubs);
      },
      (snapshotError) => setError(snapshotError.message)
    );
    return stopMembership;
  }, [user]);

  const email = profile?.email || user?.email || "-";
  const role = profile?.role ?? "öğrenci";
  const clubId = profile?.clubId ?? "";
  const banned = profile?.banned === true;
  const points = profile?.points ?? 0;
  const badges = profile?.badges ?? [];

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

      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <p><span className="text-text2">E-posta:</span> {email}</p>
          <p><span className="text-text2">Rol:</span> {role}</p>
          <p><span className="text-text2">Toplam puan:</span> {points}</p>
          <p><span className="text-text2">Club ID:</span> {clubId || "-"}</p>
        </div>
        <div className="mt-3">
          <Chip className={banned ? "border-danger/50 bg-danger/10 text-danger" : ""}>
            {banned ? "Banlı" : "Aktif"}
          </Chip>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Rozetler</h2>
        {badges.length === 0 ? (
          <p className="mt-3 text-sm text-text2">Rozet bulunamadı.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {badges.map((badge) => (
              <li key={badge.id} className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-3 py-2">
                <span>{badge.id}</span>
                <span className="text-sm text-text2">{formatDate(badge.earnedAt)}</span>
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
                <p className="font-medium">{checkin.eventId}</p>
                <p className="text-sm text-text2">{formatDate(checkin.checkinAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Üye olduğum kulüpler</h2>
        {memberClubs.length === 0 ? (
          <p className="mt-3 text-sm text-text2">Kulüp üyeliği bulunamadı.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {memberClubs.map((club) => (
              <Chip key={club.id}>{club.name}</Chip>
            ))}
          </div>
        )}
      </Card>

      {error && <p className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
