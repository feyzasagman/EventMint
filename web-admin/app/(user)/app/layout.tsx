"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/app/events", label: "Etkinlikler", icon: "📅" },
  { href: "/app/discover", label: "Keşfet", icon: "🔎" },
  { href: "/app/profile", label: "Profil", icon: "★" },
];

export default function UserAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/app/events" className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white shadow-sm">
              E
            </div>
            <div>
              <p className="font-semibold">EventMint</p>
              <p className="text-xs text-slate-500">Öğrenci Paneli</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span> {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/auth"
            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Kullanıcı
          </Link>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5 pb-3 md:hidden">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                  active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
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
  );
}
