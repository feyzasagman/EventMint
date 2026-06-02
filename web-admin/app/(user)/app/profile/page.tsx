"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  Timestamp,
  where,
} from "firebase/firestore";
import { EmptyState } from "../../../components/EmptyState";
import { auth, db } from "../../../../lib/firebase";

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

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function formatDate(value?: Timestamp) {
  return value?.toDate().toLocaleString("tr-TR") ?? "-";
}

async function resolveEventTitle(eventId?: string) {
  if (!eventId) return "Etkinlik bilinmiyor";
  const snapshot = await getDoc(doc(db, "Etkinlikler", eventId));
  if (snapshot.exists()) {
    const data = snapshot.data() as Record<string, unknown>;
    return pickString(data, ["title", "Baslik", "Başlık", "baslik", "başlık"]) ?? eventId;
  }

  const fallback = await getDoc(doc(db, "events", eventId));
  if (fallback.exists()) {
    const data = fallback.data() as Record<string, unknown>;
    return pickString(data, ["title", "Baslik", "Başlık", "baslik", "başlık"]) ?? eventId;
  }

  return eventId;
}

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
      title: pickString(data, ["title", "name", "ad", "Ad"]) ?? id,
      earnedAt: data.earnedAt as Timestamp | undefined,
    });
  }
  return badges;
}

export default function UserProfilePage() {
  const [uid, setUid] = useState("demo-user");
  const [points, setPoints] = useState(0);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [loadingCheckins, setLoadingCheckins] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? "demo-user");
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const stop = onSnapshot(doc(db, "users", uid), (snapshot) => {
      const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
      setPoints(Number(data.points ?? data.Puan ?? data.puan ?? 0));
      setBadges(parseBadges(data.Rozetler ?? data.badges ?? data.rozetler));
    });
    return stop;
  }, [uid]);

  useEffect(() => {
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

    const primaryQuery =
      uid === "demo-user"
        ? query(collection(db, "Check-in"), orderBy("checkinAt", "desc"), limit(10))
        : query(collection(db, "Check-in"), where("UID", "==", uid));

    let fallbackStop: (() => void) | null = null;
    const stop = onSnapshot(
      primaryQuery,
      (snapshot) => {
        if (snapshot.empty && uid !== "demo-user") {
          fallbackStop = onSnapshot(query(collection(db, "Check-in"), where("uid", "==", uid)), handleSnapshot);
          return;
        }
        handleSnapshot(snapshot);
      },
      () => {
        setLoadingCheckins(false);
      }
    );

    return () => {
      stop();
      fallbackStop?.();
    };
  }, [uid]);

  const latestBadge = useMemo(() => badges[0], [badges]);

  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">Profil</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">Katılım profilin</h1>
        <p className="mt-2 text-sm text-slate-600">Puanlarını, rozetlerini ve check-in geçmişini takip et.</p>
      </div>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Puan</p>
          <p className="mt-3 text-4xl font-semibold">{points}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Rozet</p>
          <p className="mt-3 text-4xl font-semibold">{badges.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Son rozet</p>
          <p className="mt-3 text-xl font-semibold">{latestBadge?.title ?? "-"}</p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Rozetler</h2>
        {badges.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Henüz rozet yok.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span key={badge.id} className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
                ★ {badge.title}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Katılım Geçmişi</h2>
        {loadingCheckins && <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />}
        {!loadingCheckins && checkins.length === 0 && (
          <EmptyState title="Henüz check-in yok" subtitle="Etkinliklere katıldığında geçmişin burada görünecek." icon="📍" />
        )}
        {checkins.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white px-5 shadow-sm">
            {checkins.map((checkin) => (
              <li key={checkin.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{checkin.eventTitle}</p>
                  <p className="text-sm text-slate-500">{checkin.eventId}</p>
                </div>
                <p className="text-sm text-slate-500">{formatDate(checkin.checkinAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
