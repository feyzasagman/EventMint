import Link from "next/link";
import { Card } from "./ui/card";
import { Chip } from "./ui/chip";
import { ClubLogoAvatar } from "./ClubLogoAvatar";

export type ClubCardProps = {
  id: string;
  name: string;
  bio?: string;
  handle?: string;
  tags?: string[];
  logoKey?: string;
  detailPathPrefix?: string;
};

export function ClubCard({
  id,
  name,
  bio,
  handle,
  tags = [],
  logoKey,
  detailPathPrefix = "/clubs",
}: ClubCardProps) {
  const visibleTags = tags.slice(0, 3);
  const hiddenTagCount = tags.length - visibleTags.length;

  return (
    <Link href={`${detailPathPrefix}/${id}`} className="block h-full">
      <Card className="group flex h-full flex-col overflow-hidden p-0 transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_12px_36px_rgba(109,94,247,0.22)]">
        <div className="relative h-24 overflow-hidden rounded-b-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#2D1B69] to-[#6D28D9]" />
          <div className="pointer-events-none absolute -left-6 -top-8 size-32 rounded-full bg-violet-500/20 blur-2xl" />
          <div className="pointer-events-none absolute bottom-1 right-3 text-white/10">
            <svg aria-hidden viewBox="0 0 24 24" className="size-12" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </div>
          <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100 group-hover:shadow-[inset_0_0_40px_rgba(109,94,247,0.12)]" />
        </div>

        <div className="relative flex flex-1 flex-col px-5 pb-5 pt-0">
          <div className="-mt-9 mb-3">
            <ClubLogoAvatar name={name} logoKey={logoKey} size={72} profileStyle />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="line-clamp-1 text-lg font-bold tracking-tight text-text">
                {name}
              </h2>
              {handle && (
                <p className="mt-1 line-clamp-1 text-sm text-text2">{handle}</p>
              )}
            </div>
            <span
              aria-hidden
              className="shrink-0 text-text2 transition group-hover:text-brand"
            >
              →
            </span>
          </div>

          {bio && (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-text2">
              {bio}
            </p>
          )}

          {visibleTags.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              {visibleTags.map((tag) => (
                <Chip key={tag}>{tag}</Chip>
              ))}
              {hiddenTagCount > 0 && <Chip>+{hiddenTagCount}</Chip>}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
