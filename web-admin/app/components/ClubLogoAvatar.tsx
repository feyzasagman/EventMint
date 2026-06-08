"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { clubLogoPath } from "../shared/clubLogos";

export type ClubLogoAvatarProps = {
  name: string;
  logoKey?: string | null;
  logoUrl?: string | null;
  size?: number;
  className?: string;
  profileStyle?: boolean;
};

export function ClubLogoAvatar({
  name,
  logoKey,
  logoUrl,
  size = 72,
  className = "",
  profileStyle = false,
}: ClubLogoAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [logoKey, logoUrl]);

  const initial = name.charAt(0).toUpperCase() || "?";
  const registryPath = clubLogoPath(logoKey);
  const src = !imageFailed ? registryPath ?? logoUrl?.trim() ?? null : null;
  const glow = profileStyle
    ? "0 4px 10px rgba(0,0,0,0.45), 0 0 16px rgba(124,58,237,0.35)"
    : "0 0 18px rgba(109, 94, 247, 0.32)";
  const fontSize = Math.round(size * 0.38);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${
        profileStyle
          ? "border-2 border-[#7C3AED] bg-[#111827]"
          : "border border-border bg-surface2"
      } ${className}`}
      style={{ width: size, height: size, boxShadow: glow }}
      aria-hidden={!!src}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          className="size-full object-contain p-[8%]"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className="flex size-full items-center justify-center bg-brand/20 font-bold text-brand"
          style={{ fontSize }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
