"use client";

import type { ReactNode } from "react";
import { ClubCoverBanner } from "./ClubCoverBanner";
import { ClubLogoAvatar } from "./ClubLogoAvatar";

export type ClubHeroHeaderProps = {
  name: string;
  handle: string;
  bio?: string;
  logoKey?: string;
  logoUrl?: string;
  coverUrl?: string;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function ClubHeroHeader({
  name,
  handle,
  bio,
  logoKey,
  logoUrl,
  coverUrl,
  meta,
  actions,
}: ClubHeroHeaderProps) {
  return (
    <section className="border-b border-border pb-5">
      <div className="relative">
        <ClubCoverBanner coverUrl={coverUrl} />

        {actions ? (
          <div className="absolute right-4 top-4 z-10">{actions}</div>
        ) : null}

        <div className="absolute -bottom-12 left-5 z-10 md:-bottom-14 md:left-6">
          <ClubLogoAvatar
            name={name}
            logoKey={logoKey}
            logoUrl={logoUrl}
            size={96}
            profileStyle
          />
        </div>
      </div>

      <div className="px-5 pt-16 md:px-6 md:pt-[4.75rem]">
        <h1 className="text-2xl font-extrabold tracking-tight text-text md:text-3xl">
          {name}
        </h1>
        <p className="mt-1 text-sm font-medium text-text2">{handle}</p>
        {meta ? <div className="mt-3">{meta}</div> : null}
        {bio ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-text2">{bio}</p>
        ) : null}
      </div>
    </section>
  );
}
