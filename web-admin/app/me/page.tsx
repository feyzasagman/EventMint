"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { getUserRole } from "../../lib/role";

export default function MePage() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"student" | "manager" | null>(null);
  const [userDoc, setUserDoc] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadUserData = async (uid: string) => {
    const snapshot = await getDoc(doc(db, "users", uid));
    setUserDoc(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null);
    setRole(await getUserRole(uid));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setError(null);

      if (!currentUser) {
        setRole(null);
        setUserDoc(null);
        setLoading(false);
        return;
      }

      try {
        await loadUserData(currentUser.uid);
      } catch (e: any) {
        console.error("Me page error:", e);
        setError(e?.message ?? JSON.stringify(e));
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const makeManager = async () => {
    if (!user) return;

    setUpdating(true);
    setError(null);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email ?? "",
          role: "manager",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await loadUserData(user.uid);
    } catch (e: any) {
      console.error("Role update error:", e);
      setError(e?.message ?? JSON.stringify(e));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="mb-4 text-3xl font-semibold">/me (Debug)</h1>

      {loading && <p>Yukleniyor...</p>}
      {!loading && !user && <p>Login degilsin.</p>}

      {!loading && user && (
        <div className="space-y-4">
          <p>
            <strong>uid:</strong> {user.uid}
          </p>
          <p>
            <strong>email:</strong> {user.email ?? "-"}
          </p>
          <p>
            <strong>role:</strong> {role ?? "null"}
          </p>

          <button
            type="button"
            onClick={makeManager}
            disabled={updating}
            className="rounded-md border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Rolumu manager yap (DEV)
          </button>

          <div>
            <p className="mb-1 font-medium">users/{"{uid}"} doc JSON</p>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(userDoc, null, 2) ?? "null"}
            </pre>
          </div>
        </div>
      )}

      {error && (
        <pre style={{ color: "salmon", whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
      )}
    </main>
  );
}
