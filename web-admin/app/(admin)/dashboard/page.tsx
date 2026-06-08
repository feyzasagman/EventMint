"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  DocumentData,
  limit,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  Timestamp,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { COL } from "../../../lib/collections";
import { seedDemoClubs } from "../../../lib/demoClubs";
import { getUserRecord } from "../../../lib/guard";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Chip } from "../../components/ui/chip";

type CheckinItem = {
  id: string;
  eventId?: string;
  uid?: string;
  checkinAt?: Timestamp;
};

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function isClubManagerRole(role?: string) {
  return role === "club_manager" || role === "manager" || role === "kulüp_yöneticisi";
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text2">{label}</p>
        <span className="flex size-10 items-center justify-center rounded-2xl bg-brand/20 text-xl">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-4xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [eventCount, setEventCount] = useState(0);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [checkinCount, setCheckinCount] = useState(0);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [seedingClubs, setSeedingClubs] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  useEffect(() => {
    const stops: Array<() => void> = [];

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      stops.forEach((stop) => stop());
      stops.length = 0;

      if (!user && !isDemoMode) {
        router.replace("/login");
        return;
      }

      if (!user) {
        setIsAdmin(isDemoMode);
        return;
      }

      const handleCheckins = (snapshot: QuerySnapshot<DocumentData>) => {
        setCheckins(
          snapshot.docs.map((docSnapshot) => {
            const data = docSnapshot.data() as Record<string, unknown>;
            return {
              id: docSnapshot.id,
              eventId: data.eventId?.toString(),
              uid: (data.UID ?? data.uid)?.toString(),
              checkinAt: data.checkinAt as Timestamp | undefined,
            };
          })
        );
      };

      stops.push(
        onSnapshot(collection(db, "events"), (snapshot) => setEventCount(snapshot.docs.length))
      );

      void getUserRecord(user.uid)
        .then((record) => {
          const admin = record.role === "admin";
          const manager = isClubManagerRole(record.role);
          setIsAdmin(admin);

          if (admin || manager) {
            stops.push(
              onSnapshot(collection(db, COL.rsvps), (snapshot) => setRsvpCount(snapshot.docs.length))
            );
            stops.push(
              onSnapshot(collection(db, COL.checkins), (snapshot) =>
                setCheckinCount(snapshot.docs.length)
              )
            );
            stops.push(
              onSnapshot(
                query(collection(db, COL.checkins), orderBy("checkinAt", "desc"), limit(10)),
                handleCheckins,
                (error) => console.error("dashboard checkins:", error)
              )
            );
            return;
          }

          const uid = user.uid;
          stops.push(
            onSnapshot(
              query(collection(db, COL.rsvps), where("uid", "==", uid)),
              (snapshot) => setRsvpCount(snapshot.docs.length),
              (error) => console.error("dashboard rsvps:", error)
            )
          );
          stops.push(
            onSnapshot(
              query(collection(db, COL.checkins), where("uid", "==", uid)),
              (snapshot) => {
                setCheckinCount(snapshot.docs.length);
                handleCheckins(snapshot);
              },
              (error) => console.error("dashboard checkins:", error)
            )
          );
        })
        .catch((error) => {
          console.error("dashboard role lookup:", error);
          setIsAdmin(false);
        });
    });

    return () => {
      unsubscribe();
      stops.forEach((stop) => stop());
    };
  }, [router]);

  const handleSeedDemoClubs = async () => {
    const user = auth.currentUser;
    if (!user) {
      setSeedNotice("Oturum gerekli.");
      return;
    }

    setSeedingClubs(true);
    setSeedNotice(null);

    try {
      const result = await seedDemoClubs(db, {
        adminUid: user.uid,
        skipExisting: true,
      });

      const parts: string[] = [];
      if (result.created.length > 0) {
        parts.push(`${result.created.length} kulüp eklendi (${result.created.join(", ")})`);
      }
      if (result.skipped.length > 0) {
        parts.push(`${result.skipped.length} zaten vardı`);
      }
      if (result.errors.length > 0) {
        parts.push(`Hata: ${result.errors.map((e) => e.id).join(", ")}`);
      }
      setSeedNotice(parts.join(" · ") || "İşlem tamamlandı.");
    } catch (error) {
      setSeedNotice(error instanceof Error ? error.message : "Seed başarısız.");
    } finally {
      setSeedingClubs(false);
    }
  };

  return (
    <>
      {isAdmin && (
        <Card className="mb-8 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Demo kulüpler</h2>
              <p className="mt-1 text-sm text-text2">
                yazilim, girisimcilik, fotografcilik — mevcut belgeler korunur.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSeedDemoClubs}
              disabled={seedingClubs}
            >
              {seedingClubs ? "Ekleniyor..." : "Demo kulüpleri ekle"}
            </Button>
          </div>
          {seedNotice ? (
            <p className="mt-3 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-text2">
              {seedNotice}
            </p>
          ) : null}
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="Toplam etkinlik" value={eventCount} icon="📅" />
        <StatCard label="Toplam Katılım" value={rsvpCount} icon="✅" />
        <StatCard label="Toplam check-in" value={checkinCount} icon="📍" />
      </div>

      <Card className="mt-8 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Son check-in’ler</h2>
          <Chip>Son 10 kayıt</Chip>
        </div>

        {checkins.length === 0 ? (
          <p className="rounded-2xl bg-surface2 px-4 py-8 text-center text-sm text-text2">
            Henüz check-in yok.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {checkins.slice(0, 10).map((checkin) => (
              <li key={checkin.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{checkin.eventId ?? "Etkinlik bilinmiyor"}</p>
                  <p className="text-sm text-text2">{checkin.uid ?? "UID yok"}</p>
                </div>
                <p className="text-sm text-text2">
                  {checkin.checkinAt?.toDate().toLocaleString("tr-TR") ?? "-"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
