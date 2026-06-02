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
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { Card } from "../../components/ui/card";
import { Chip } from "../../components/ui/chip";

type CheckinItem = {
  id: string;
  eventId?: string;
  uid?: string;
  checkinAt?: Timestamp;
};

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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

  useEffect(() => {
    const stops: Array<() => void> = [];
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && !isDemoMode) {
        router.replace("/login");
        return;
      }

      stops.push(onSnapshot(collection(db, "events"), (snapshot) => setEventCount(snapshot.docs.length)));
      stops.push(onSnapshot(collection(db, "RSVP'ler"), (snapshot) => setRsvpCount(snapshot.docs.length)));
      stops.push(onSnapshot(collection(db, "Check-in"), (snapshot) => setCheckinCount(snapshot.docs.length)));

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
        onSnapshot(
          query(collection(db, "Check-in"), orderBy("checkinAt", "desc"), limit(10)),
          handleCheckins,
          () => {
            stops.push(onSnapshot(collection(db, "Check-in"), handleCheckins));
          }
        )
      );
    });

    return () => {
      unsubscribe();
      stops.forEach((stop) => stop());
    };
  }, [router]);

  return (
    <>
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
