import Link from "next/link";

const features = [
  {
    icon: "📅",
    title: "Etkinlik Yönetimi",
    text: "Etkinlikleri oluştur, listele ve hızlıca yönet.",
  },
  {
    icon: "▦",
    title: "QR Check-in",
    text: "Canlı QR oturumlarıyla katılımı kolayca takip et.",
  },
  {
    icon: "★",
    title: "Puan & Rozet",
    text: "Katılımcı motivasyonunu puan ve rozetlerle güçlendir.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.35),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.18),_transparent_34%),linear-gradient(135deg,_#020617_0%,_#111827_48%,_#1e1b4b_100%)] px-6 py-12 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:56px_56px] opacity-20" />
      <div className="absolute -left-28 top-16 size-80 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="absolute -right-24 bottom-10 size-96 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-[900px] flex-col justify-center">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500 text-lg font-bold shadow-lg shadow-violet-500/30">
            E
          </div>
          <div>
            <p className="text-xl font-semibold tracking-tight">EventMint</p>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-violet-200/80">
              Web Admin
            </p>
          </div>
        </div>

        <section className="mb-8 max-w-3xl">
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Admin Panel
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Etkinlikleri yönet, QR check-in oturumu başlat, katılımı takip et.
          </p>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.08] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-violet-200">
              Hızlı Başlangıç
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Paneline hızlıca geç</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Etkinlik listesini açabilir veya gerçek yönetici hesabınla giriş yapabilirsin.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link
                href="/auth"
                className="rounded-2xl bg-violet-500 px-5 py-4 text-center text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:bg-violet-400"
              >
                Öğrenci Girişi
              </Link>
              <Link
                href="/events"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-center text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Admin Panel
              </Link>
            </div>

            <Link
              href="/events"
              className="mt-5 inline-flex text-sm font-medium text-violet-200 transition hover:text-white"
            >
              Demo modda devam et →
            </Link>
          </section>

          <section className="grid gap-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[24px] border border-white/10 bg-white/[0.07] p-5 shadow-xl shadow-black/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {feature.text}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}