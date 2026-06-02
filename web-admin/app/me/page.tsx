"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useAuth } from "../providers/AuthProvider";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

export default function MePage() {
  const { user, loading } = useAuth();
  const [resolvedUid, setResolvedUid] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    let isCancelled = false;
    getDoc(doc(db, "users", user.uid))
      .then((snapshot) => {
        if (isCancelled) return;
        setResolvedUid(user.uid);
        setError(null);
        setUserDoc(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null);
      })
      .catch((e: unknown) => {
        if (isCancelled) return;
        setResolvedUid(user.uid);
        setUserDoc(null);
        console.error("Me page error:", e);
        setError(getErrorMessage(e));
      });

    return () => {
      isCancelled = true;
    };
  }, [loading, user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setSigningOut(false);
    }
  };

  const visibleUserDoc = user && resolvedUid === user.uid ? userDoc : null;
  const docLoading = !!user && !loading && resolvedUid !== user.uid;
  const role = typeof visibleUserDoc?.role === "string" ? (visibleUserDoc.role as string) : "null";
  const clubId = typeof visibleUserDoc?.clubId === "string" ? (visibleUserDoc.clubId as string) : "null";
  const banned = visibleUserDoc?.banned === true ? "true" : "false";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="mb-4 text-3xl font-semibold">/me (Debug)</h1>

      {loading && <p>Yükleniyor...</p>}
      {!loading && docLoading && <p>Kullanıcı dokümanı yükleniyor...</p>}

      {!loading && !user && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Not logged in
        </p>
      )}

      {!loading && user && (
        <div className="space-y-5">
          <div className="grid gap-2 rounded-3xl border border-zinc-200 bg-white p-5 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p>
              <span className="font-medium">uid:</span>{" "}
              <span className="font-mono">{user.uid}</span>
            </p>
            <p>
              <span className="font-medium">email:</span> {user.email ?? "-"}
            </p>
            <p>
              <span className="font-medium">role:</span> {role}
            </p>
            <p>
              <span className="font-medium">clubId:</span> {clubId}
            </p>
            <p>
              <span className="font-medium">banned:</span> {banned}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-xl border border-zinc-300 px-3 py-2 text-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {signingOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 font-medium">users/{"{uid}"} doc JSON</p>
            <pre className="overflow-x-auto rounded-2xl bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
              {visibleUserDoc ? JSON.stringify(visibleUserDoc, null, 2) : "users/{uid} dokümanı bulunamadı."}
            </pre>
          </div>
        </div>
      )}

      {error && (
        <pre className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </pre>
      )}
    </main>
  );
}
