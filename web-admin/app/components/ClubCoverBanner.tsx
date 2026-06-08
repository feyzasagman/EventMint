"use client";

import { useState } from "react";

export type ClubCoverBannerProps = {
  coverUrl?: string;
  heightClassName?: string;
};

export function ClubCoverBanner({
  coverUrl,
  heightClassName = "h-[180px] md:h-[220px]",
}: ClubCoverBannerProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = coverUrl && !imageFailed;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-b-2xl ${heightClassName}`}
    >
      {showImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={() => setImageFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#2D1B69] to-[#6D28D9]" />
      )}

      <div className="pointer-events-none absolute -left-8 -top-10 size-44 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/2 size-32 -translate-y-1/2 rounded-full bg-indigo-400/10 blur-2xl" />

      <div className="pointer-events-none absolute bottom-2 right-4 text-white/10">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-16 md:size-20"
          fill="currentColor"
        >
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      </div>
    </div>
  );
}
