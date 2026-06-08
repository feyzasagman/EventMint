"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { EventMintLogo } from "./EventMintLogo";
import { auth } from "../../lib/firebase";

const navItems = [
  { href: "/events", label: "Etkinlikler", icon: "📅" },
  { href: "/discover", label: "Keşfet", icon: "🔎" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
];

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white/90 px-5 py-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 lg:block">
        <Link href="/events" className="flex items-center gap-3">
          <EventMintLogo size={44} />
          <div>
            <p className="font-semibold">EventMint</p>
            <p className="text-xs text-zinc-500">Admin Panel</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                EventMint
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden rounded-2xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300 sm:block">
                Yönetici
              </div>
              {isDemoMode && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  Demo Mode
                </span>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                Çıkış
              </button>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-5 pb-3 lg:hidden">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {item.icon} {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
      </div>
    </div>
  );
}
