import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>EventMint Web Admin</h1>
      <p>Yonetici paneli baslangic sayfasi</p>
      <div style={{ display: "flex", gap: 16 }}>
        <Link href="/login">Login</Link>
        <Link href="/events">Events</Link>
      </div>
    </main>
  );
}