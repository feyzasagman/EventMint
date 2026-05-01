"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, DocumentData, onSnapshot, Timestamp, updateDoc } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../../../../lib/firebase";
import { getUserRole } from "../../../../lib/role";

type SessionData = {
  eventId?: string;
  active?: boolean;
  createdAt?: Timestamp;
  expiresAt?: Timestamp;
  nonce?: string;
};

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function normalizeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

export default function EventQrPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = normalizeParam(params.id);
  const sessionId = searchParams.get("sessionId");

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const role = await getUserRole(user.uid);
        setHasAccess(role === "manager");
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setCheckingAccess(false);
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!sessionId || !hasAccess) {
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "sessions", sessionId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setSession(null);
          setError("Session bulunamadı.");
          return;
        }

        setSession(snapshot.data() as DocumentData as SessionData);
        setError(null);
      },
      (snapshotError) => {
        console.error("Session read error:", snapshotError);
        setError(snapshotError.message);
      }
    );

    return unsubscribe;
  }, [hasAccess, sessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const qrText = useMemo(() => {
    if (!sessionId || !session?.nonce) return "";
    return `${sessionId}|${session.nonce}`;
  }, [session?.nonce, sessionId]);

  const closeSession = async () => {
    if (!sessionId) return;

    setClosing(true);
    try {
      await updateDoc(doc(db, "sessions", sessionId), { active: false });
    } catch (e: unknown) {
      console.error("Close session error:", e);
      setError(getErrorMessage(e));
    } finally {
      setClosing(false);
    }
  };

  const expiresAtMs = session?.expiresAt?.toDate().getTime();
  const expiresAtText = session?.expiresAt?.toDate().toLocaleString("tr-TR") ?? "-";
  const remainingMs = expiresAtMs ? expiresAtMs - now : 0;
  const isExpired = remainingMs <= 0;
  const isInactive = session?.active === false;
  const eventMismatch = session?.eventId && eventId && session.eventId !== eventId;
  const loadingSession = hasAccess && Boolean(sessionId) && !session && !error;

  if (checkingAccess) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p>Yetki kontrol ediliyor...</p>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="mb-4 text-3xl font-semibold">Check-in QR</h1>
        <p>Yetkin yok.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <button
        type="button"
        onClick={() => router.push("/events")}
        className="mb-6 rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        ← Events listesine dön
      </button>

      <h1 className="mb-6 text-3xl font-semibold">Check-in QR</h1>

      {!sessionId && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          sessionId eksik.
        </p>
      )}

      {loadingSession && <p>Session yukleniyor...</p>}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          {error}
        </p>
      )}

      {eventMismatch && (
        <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-800">
          Bu session farklı bir etkinliğe ait görünüyor.
        </p>
      )}

      {isInactive && (
        <p className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-800">
          Oturum kapalı.
        </p>
      )}

      {session && qrText && (
        <section className="space-y-6 rounded-lg border p-6 shadow-sm">
          <div className="flex justify-center rounded-lg bg-white p-6">
            <QRCodeSVG value={qrText} size={260} level="M" includeMargin />
          </div>

          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Kalan süre:</span>{" "}
              <span className={isExpired ? "text-red-600" : "text-green-700"}>
                {isExpired ? "Süre doldu" : formatRemaining(remainingMs)}
              </span>
            </p>
            <p>
              <span className="font-medium">Session ID:</span> {sessionId}
            </p>
            <p>
              <span className="font-medium">Nonce:</span> {session.nonce}
            </p>
            <p>
              <span className="font-medium">ExpiresAt:</span> {expiresAtText}
            </p>
            <p className="break-all rounded-md bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
              {qrText}
            </p>
          </div>

          <button
            type="button"
            onClick={closeSession}
            disabled={closing || isInactive}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {closing ? "Kapatılıyor..." : isInactive ? "Oturum kapalı" : "Oturumu kapat"}
          </button>
        </section>
      )}
    </main>
  );
}
