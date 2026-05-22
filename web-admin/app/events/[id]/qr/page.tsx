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
  const [copied, setCopied] = useState(false);

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

  const copyQrText = async () => {
    if (!qrText) return;
    await navigator.clipboard.writeText(qrText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <button
        type="button"
        onClick={() => router.push("/events")}
        className="mb-6 rounded-xl border border-zinc-300 px-3 py-2 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        ← Events listesine dön
      </button>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Check-in oturumu
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Check-in QR</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Katılımcılar mobil uygulamada bu QR kodu okutarak check-in yapar.
          </p>
        </div>
        {session && (
          <button
            type="button"
            onClick={closeSession}
            disabled={closing || isInactive}
            className="rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {closing ? "Kapatılıyor..." : isInactive ? "Oturum kapalı" : "Oturumu kapat"}
          </button>
        )}
      </div>

      {!sessionId && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          sessionId eksik.
        </p>
      )}

      {loadingSession && <p>Session yukleniyor...</p>}

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      )}

      {eventMismatch && (
        <p className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800">
          Bu session farklı bir etkinliğe ait görünüyor.
        </p>
      )}

      {isInactive && (
        <p className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800">
          Oturum kapalı.
        </p>
      )}

      {session && isExpired && !isInactive && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <p className="font-semibold">Süre doldu</p>
          <p className="mt-1 text-sm">Bu QR oturumunun geçerlilik süresi bitti. Yeni bir oturum başlatabilirsin.</p>
        </div>
      )}

      {session && qrText && (
        <section className="grid gap-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col items-center justify-center rounded-3xl bg-zinc-50 p-6 dark:bg-zinc-900">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <QRCodeSVG value={qrText} size={280} level="M" includeMargin />
            </div>
            <button
              type="button"
              onClick={copyQrText}
              className="mt-5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              {copied ? "Kopyalandı" : "Kodu kopyala"}
            </button>
          </div>

          <div className="space-y-4 text-sm">
            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-zinc-500 dark:text-zinc-400">Kalan süre</p>
              <p className={isExpired ? "mt-1 text-lg font-semibold text-red-600" : "mt-1 text-lg font-semibold text-green-700"}>
                {isExpired ? "Süre doldu" : formatRemaining(remainingMs)}
              </p>
            </div>
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
            <p className="break-all rounded-2xl bg-zinc-100 p-4 font-mono text-xs dark:bg-zinc-900">
              {qrText}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
