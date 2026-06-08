"use client";

import Image from "next/image";
import type { Timestamp } from "firebase/firestore";
import {
  formatBadgeDate,
  splitBadgeSections,
  type EarnedBadge,
} from "../shared/badges";

type BadgeShowcaseProps = {
  badges: EarnedBadge[];
};

function BadgeCard({
  title,
  subtitle,
  imagePath,
  glow,
  earnedAt,
  locked = false,
}: {
  title: string;
  subtitle: string;
  imagePath: string;
  glow: string;
  earnedAt?: Timestamp | Date;
  locked?: boolean;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-4 transition duration-200 ${
        locked
          ? "border-border/60 bg-surface2/40 opacity-80"
          : "group border-border bg-surface2 hover:-translate-y-0.5 hover:border-brand/40"
      }`}
      style={locked ? undefined : { boxShadow: `0 0 0 0 ${glow}` }}
      onMouseEnter={
        locked
          ? undefined
          : (e) => {
              e.currentTarget.style.boxShadow = `0 0 28px ${glow}`;
            }
      }
      onMouseLeave={
        locked
          ? undefined
          : (e) => {
              e.currentTarget.style.boxShadow = `0 0 0 0 ${glow}`;
            }
      }
    >
      <div className="mb-3 flex justify-center">
        <div className={`relative ${locked ? "opacity-45 blur-[2px] grayscale-[0.35]" : ""}`}>
          <Image
            src={imagePath}
            alt={title}
            width={96}
            height={96}
            className={`size-24 object-contain ${locked ? "" : "drop-shadow-[0_0_12px_rgba(109,94,247,0.35)]"}`}
          />
          {locked ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full border border-border/80 bg-background/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text2">
                Kilitli
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <h3 className={`font-semibold ${locked ? "text-text2" : "text-text"}`}>{title}</h3>
      <p className="mt-1 text-xs text-text2">{subtitle}</p>
      {!locked ? (
        <p className="mt-3 text-xs text-text2">
          Kazanıldı: {formatBadgeDate(earnedAt)}
        </p>
      ) : (
        <p className="mt-3 text-xs text-text2/80">Henüz kazanılmadı</p>
      )}
    </article>
  );
}

function BadgeGridSection({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {children ?? (
        emptyText ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-surface2/60 px-4 py-8 text-center text-sm text-text2">
            {emptyText}
          </p>
        ) : null
      )}
    </section>
  );
}

export function BadgeShowcase({ badges }: BadgeShowcaseProps) {
  const { earned, locked } = splitBadgeSections(badges);

  return (
    <div>
      <BadgeGridSection
        title="Kazanılan Rozetler"
        emptyText="Henüz rozet kazanılmadı."
      >
        {earned.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            {earned.map(({ definition, earned: item }) => (
              <BadgeCard
                key={definition.id}
                title={definition.title}
                subtitle={definition.subtitle}
                imagePath={definition.imagePath}
                glow={definition.glow}
                earnedAt={item.earnedAt}
              />
            ))}
          </div>
        ) : null}
      </BadgeGridSection>

      <BadgeGridSection title="Kilitli Rozetler">
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          {locked.map((definition) => (
            <BadgeCard
              key={definition.id}
              title={definition.title}
              subtitle={definition.subtitle}
              imagePath={definition.imagePath}
              glow={definition.glow}
              locked
            />
          ))}
        </div>
      </BadgeGridSection>
    </div>
  );
}

/** @deprecated Use BadgeShowcase */
export function BadgeGrid({ badges }: BadgeShowcaseProps) {
  return <BadgeShowcase badges={badges} />;
}
