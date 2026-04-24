"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getUserRole } from "../../lib/role";
import { auth, db } from "../../lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureUserDoc = async (uid: string, userEmail?: string | null) => {
    const role = await getUserRole(uid);
    if (role === null) {
      await setDoc(doc(db, "users", uid), {
        email: userEmail ?? email,
        role: "student",
        createdAt: serverTimestamp(),
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        await ensureUserDoc(user.uid, user.email);
      } catch (e) {
        console.error("Ensure user doc error:", e);
      } finally {
        router.replace("/events");
      }
    });

    return unsubscribe;
  }, [router]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(credential.user.uid, credential.user.email);
      router.push("/events");
    } catch (e: any) {
      console.error("Login error:", e);
      setError(e?.message ?? JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError(null);

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", credential.user.uid), {
        email: credential.user.email ?? email,
        role: "student",
        createdAt: serverTimestamp(),
      });
      router.push("/events");
    } catch (e: any) {
      console.error("Register error:", e);
      setError(e?.message ?? JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="mb-6 text-3xl font-semibold">Login</h1>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            required
          />
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="rounded-md bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Giriş Yap
          </button>
          <button
            type="button"
            onClick={handleRegister}
            disabled={loading || !email || !password}
            className="rounded-md border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Kayıt Ol
          </button>
        </div>
      </div>
    </main>
  );
}
