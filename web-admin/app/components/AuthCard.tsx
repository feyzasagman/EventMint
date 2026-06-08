"use client";

import Image from "next/image";

export type AuthMode = "student" | "admin";

export function AuthCard({
  mode,
  isRegister,
  onModeChange,
  onToggleRegister,
  email,
  password,
  passwordConfirm,
  loading,
  resettingPassword,
  error,
  success,
  onEmailChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onSubmit,
  onForgotPassword,
  onDemo,
}: {
  mode: AuthMode;
  isRegister: boolean;
  onModeChange: (mode: AuthMode) => void;
  onToggleRegister: () => void;
  email: string;
  password: string;
  passwordConfirm: string;
  loading: boolean;
  resettingPassword?: boolean;
  error?: string | null;
  success?: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
  onDemo: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="w-full max-w-[430px] rounded-[30px] border border-white/10 bg-white/[0.08] p-8 text-white shadow-2xl shadow-black/40 backdrop-blur-2xl"
    >
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex size-[72px] items-center justify-center">
          <Image
            src="/logo.png"
            alt="EventMint"
            width={72}
            height={72}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">EventMint</h1>
        <p className="mt-2 text-sm text-slate-300">
          {isRegister ? "Yeni hesap oluştur" : mode === "admin" ? "Yönetici girişi" : "Öğrenci girişi"}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/50 p-1">
        {[
          ["student", "Öğrenci"],
          ["admin", "Yönetici"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value as AuthMode)}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              mode === value ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-300 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="email">
            Email
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.18)]">
            <span className="text-slate-400" aria-hidden>
              @
            </span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="mail@example.com"
              className="min-h-12 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="password">
            Password
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.18)]">
            <span className="text-slate-400" aria-hidden>
              #
            </span>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="••••••••"
              className="min-h-12 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        {isRegister && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="passwordConfirm">
              Password (tekrar)
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.18)]">
              <span className="text-slate-400" aria-hidden>
                #
              </span>
              <input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(event) => onPasswordConfirmChange(event.target.value)}
                placeholder="••••••••"
                className="min-h-12 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {!isRegister && (
          <button
            type="button"
            onClick={onForgotPassword}
            disabled={loading || resettingPassword}
            className="text-left text-sm font-medium text-indigo-200 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resettingPassword ? "Gönderiliyor..." : "Şifremi unuttum"}
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />}
          {loading ? "İşlem yapılıyor..." : isRegister ? "Kayıt Ol" : "Giriş Yap"}
        </button>

        <div className="text-center text-sm text-slate-300">
          {isRegister ? "Zaten hesabın var mı?" : "Hesabın yok mu?"}{" "}
          <button
            type="button"
            onClick={onToggleRegister}
            className="font-semibold text-indigo-200 transition hover:text-white"
          >
            {isRegister ? "Giriş Yap" : "Kayıt Ol"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onDemo}
        className="mt-6 w-full text-center text-sm font-medium text-indigo-200 transition hover:text-white"
      >
        Demo olarak devam et
      </button>
    </form>
  );
}
