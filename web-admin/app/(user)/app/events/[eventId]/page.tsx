"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { Chip } from "../../../../components/ui/chip";
import { auth, db } from "../../../../../lib/firebase";
import { COL } from "../../../../../lib/collections";
import { submitQrCheckin } from "../../../../../lib/checkin";

function pickString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
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

export default function UserEventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [clubId, setClubId] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isRsvped, setIsRsvped] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [savingRsvp, setSavingRsvp] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/auth");
        return;
      }
      setUid(user.uid);
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!eventId) {
      setError("Etkinlik bulunamadı.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const eventDoc = await getDoc(doc(db, COL.events, eventId));
        if (cancelled) return;

        if (!eventDoc.exists()) {
          setError("Etkinlik bulunamadı.");
          setLoading(false);
          return;
        }

        const data = eventDoc.data() as Record<string, unknown>;
        setTitle(pickString(data, ["title", "Baslik", "Başlık", "baslik", "başlık"]) || "Etkinlik");
        setDescription(pickString(data, ["description", "Tanim", "Tanım", "tanim", "tanım"]));
        setLocation(pickString(data, ["location", "Konum", "konum"]));
        setClubId(pickString(data, ["clubId", "Kulup", "Kulüp", "kulup", "kulüp", "club"]));
        setCategory(pickString(data, ["category", "Kategori", "kategori"]));
        setTags(pickTags(data));
        setLoading(false);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Etkinlik yüklenemedi.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!uid || !eventId) return;

    const rsvpStop = onSnapshot(
      doc(db, COL.rsvps, `${eventId}_${uid}`),
      (snapshot) => setIsRsvped(snapshot.exists()),
      () => setIsRsvped(false)
    );

    const checkinStop = onSnapshot(
      doc(db, COL.checkins, `${eventId}_${uid}`),
      (snapshot) => setIsCheckedIn(snapshot.exists()),
      () => setIsCheckedIn(false)
    );

    return () => {
      rsvpStop();
      checkinStop();
    };
  }, [eventId, uid]);

  const handleRsvp = async () => {
    if (!uid || isRsvped) return;
    setSavingRsvp(true);
    setNotice(null);
    try {
      await setDoc(
        doc(db, COL.rsvps, `${eventId}_${uid}`),
        { eventId, uid, createdAt: serverTimestamp() },
        { merge: true }
      );
      setNotice("Katılımın kaydedildi.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "RSVP kaydedilemedi.");
    } finally {
      setSavingRsvp(false);
    }
  };

  const handleCheckin = async () => {
    if (!uid || isCheckedIn) return;
    setCheckingIn(true);
    setNotice(null);
    setError(null);
    try {
      const result = await submitQrCheckin(qrCode, uid);
      if (result.ok) {
        setNotice(result.message);
        setIsCheckedIn(true);
        setQrCode("");
      } else {
        setError(result.message);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Check-in başarısız.");
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return <p className="text-text2">Etkinlik yükleniyor...</p>;
  }

  if (error && !title) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger">{error}</p>
        <Button type="button" variant="secondary" onClick={() => router.push("/app/events")}>
          ← Etkinliklere dön
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button type="button" variant="secondary" onClick={() => router.push("/app/events")}>
        ← Etkinliklere dön
      </Button>

      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {category && <Chip variant="brand">{category}</Chip>}
        </div>
        {description && <p className="mt-4 text-sm leading-7 text-text2">{description}</p>}
        <div className="mt-4 grid gap-2 text-sm text-text2">
          {clubId && (
            <p>
              <span className="font-medium">Kulüp:</span> {clubId}
            </p>
          )}
          {location && (
            <p>
              <span className="font-medium">Konum:</span> {location}
            </p>
          )}
        </div>
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </div>
        )}
      </div>

      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">Katılım</h2>
        <Button type="button" onClick={handleRsvp} disabled={isRsvped || savingRsvp}>
          {isRsvped ? "Katılacağım ✅" : savingRsvp ? "Kaydediliyor..." : "Katılacağım (RSVP)"}
        </Button>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">QR Check-in</h2>
          <p className="mt-1 text-sm text-text2">
            Yöneticinin gösterdiği QR kodu okut veya kodu aşağıya yapıştır.
          </p>
        </div>

        {isCheckedIn ? (
          <p className="font-medium text-emerald-400">Check-in yapıldı ✅</p>
        ) : (
          <>
            <input
              value={qrCode}
              onChange={(event) => setQrCode(event.target.value)}
              placeholder="sessionId|nonce"
              className="ui-input font-mono text-sm"
            />
            <p className="text-xs text-text2">
              Web paneldeki QR sayfasından &quot;Kodu kopyala&quot; ile alabilirsin.
            </p>
            <Button type="button" onClick={handleCheckin} disabled={checkingIn || !qrCode.trim()}>
              {checkingIn ? "Doğrulanıyor..." : "QR ile Check-in"}
            </Button>
          </>
        )}
      </Card>

      {notice && (
        <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">{notice}</p>
      )}
      {error && title && (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      )}
    </div>
  );
}
