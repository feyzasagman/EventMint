"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { Chip } from "../components/ui/chip";

const navItems = [
  { href: "/events", label: "Etkinlikler", icon: "📅" },
  { href: "/profile", label: "Profil", icon: "🙍" },
  { href: "/club", label: "Kulübüm", icon: "🏛️" },
  { href: "/discover", label: "Keşfet", icon: "🔎" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/users", label: "Kullanıcılar", icon: "👥" },
  { href: "/admin/managers", label: "Yöneticiler", icon: "🛡️" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const identityLabel = loading ? "Loading..." : user?.email ?? "Guest";

  return (
    <div className="min-h-screen bg-bg text-text">
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] border-r border-border bg-surface/95 px-5 py-6 backdrop-blur lg:block">
        <Link href="/events" className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-text">
            E
          </div>
          <div>
            <p className="font-semibold">EventMint Admin</p>
            <p className="text-xs text-text2">Yönetim Paneli</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-brand text-text shadow-sm"
                    : "text-text2 hover:bg-surface2 hover:text-text"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand">
                EventMint
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                Admin Panel
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Chip>{identityLabel}</Chip>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-5 pb-3 lg:hidden">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                    active
                      ? "bg-brand text-text"
                      : "bg-surface2 text-text2"
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
