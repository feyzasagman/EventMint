"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EventMintLogo } from "../components/EventMintLogo";
import { Chip } from "../components/ui/chip";
import { useAuth } from "../providers/AuthProvider";

const navItems = [
  { href: "/clubs", label: "Kulüpler", icon: "🏛️" },
  { href: "/discover", label: "Keşfet", icon: "🔎" },
  { href: "/events", label: "Etkinlikler", icon: "📅" },
];

export default function ClubsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const identityLabel = loading ? "Yükleniyor..." : user?.email ?? "Misafir";

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/clubs" className="flex items-center gap-3">
            <EventMintLogo size={44} />
            <div>
              <p className="font-semibold">EventMint</p>
              <p className="text-xs text-text2">Kulüpler</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-brand text-text shadow-[0_4px_16px_rgba(109,94,247,0.3)]"
                      : "text-text2 hover:bg-surface2 hover:text-text"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span> {item.label}
                </Link>
              );
            })}
          </nav>

          <Chip>{identityLabel}</Chip>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5 pb-3 md:hidden">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                  active ? "bg-brand text-text" : "bg-surface2 text-text2"
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
