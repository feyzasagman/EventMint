"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { AuthCard, AuthMode } from "../components/AuthCard";
import { auth, db } from "../../lib/firebase";
import { getUserRecord, isUserBanned } from "../../lib/guard";
import { isAdminPanelRole, normalizeAppRole, postLoginPath } from "../../lib/role";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeFromQuery: AuthMode = searchParams.get("mode") === "admin" ? "admin" : "student";
  const bannedNotice = searchParams.get("banned") === "1";
  const [modeOverride, setModeOverride] = useState<AuthMode | null>(null);
  const mode = modeOverride ?? modeFromQuery;
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const ensureUserDocument = async (uid: string, userEmail: string) => {
    const userRef = doc(db, "users", uid);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) return;

    await setDoc(userRef, {
      email: userEmail,
      role: "student",
      banned: false,
      createdAt: serverTimestamp(),
    });
  };

  const resolveDestination = async (uid: string) => {
    const record = await getUserRecord(uid);
    return postLoginPath(normalizeAppRole(record.role));
  };

  const handleDemo = async () => {
    const user = auth.currentUser;
    if (user) {
      router.push(await resolveDestination(user.uid));
      return;
    }
    router.push("/events");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!email || !password) {
        setError("Email ve şifre gerekli.");
        return;
      }

      if (isRegister) {
        if (!passwordConfirm) {
          setError("Şifre tekrarı gerekli.");
          return;
        }
        if (password !== passwordConfirm) {
          setError("Şifreler eşleşmiyor.");
          return;
        }
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", credential.user.uid), {
          email,
          role: "student",
          banned: false,
        });

        if (await isUserBanned(credential.user.uid)) {
          await signOut(auth);
          router.replace("/auth?banned=1");
          return;
        }

        router.push("/app/events");
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserDocument(credential.user.uid, email);
        if (await isUserBanned(credential.user.uid)) {
          await signOut(auth);
          router.replace("/auth?banned=1");
          return;
        }

        const record = await getUserRecord(credential.user.uid);
        const role = normalizeAppRole(record.role);
        if (mode === "admin" && !isAdminPanelRole(role)) {
          setError("Bu hesap yönetici paneline erişemez. Öğrenci paneline yönlendiriliyorsun.");
        }
        router.push(postLoginPath(role));
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccess(null);

    if (!email) {
      setError("Şifre sıfırlamak için önce email gir.");
      return;
    }

    setResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("Şifre sıfırlama e-postası gönderildi.");
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.35),_transparent_34%),linear-gradient(135deg,_#020617_0%,_#020617_45%,_#0f172a_72%,_#111827_100%)] px-6 py-12">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
      <div className="absolute -left-28 top-20 size-72 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="absolute -right-24 bottom-10 size-80 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative flex w-full justify-center">
        <div className="w-full max-w-[430px] space-y-3">
          {bannedNotice && (
            <div className="rounded-2xl border border-red-300/60 bg-red-500/15 px-4 py-3 text-sm text-red-100">
              Hesabınız askıya alındı. Lütfen yönetici ile iletişime geçin.
            </div>
          )}
          <AuthCard
            mode={mode}
            isRegister={isRegister}
            onModeChange={(nextMode) => {
              setModeOverride(nextMode);
              setIsRegister(false);
            }}
            onToggleRegister={() => {
              setIsRegister((current) => !current);
              setError(null);
              setSuccess(null);
            }}
            email={email}
            password={password}
            passwordConfirm={passwordConfirm}
            loading={loading}
            resettingPassword={resettingPassword}
            error={error}
            success={success}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onPasswordConfirmChange={setPasswordConfirm}
            onSubmit={handleSubmit}
            onForgotPassword={handleForgotPassword}
            onDemo={handleDemo}
          />
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthContent />
    </Suspense>
  );
}
