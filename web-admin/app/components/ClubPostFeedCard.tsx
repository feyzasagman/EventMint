import Link from "next/link";
import { Card } from "./ui/card";
import { Chip } from "./ui/chip";
import { ClubLogoAvatar } from "./ClubLogoAvatar";

export type ClubPostFeedCardProps = {
  clubId: string;
  clubName: string;
  logoKey?: string;
  logoUrl?: string;
  text: string;
  hashtags?: string[];
  createdAtLabel?: string;
};

export function ClubPostFeedCard({
  clubId,
  clubName,
  logoKey,
  logoUrl,
  text,
  hashtags = [],
  createdAtLabel,
}: ClubPostFeedCardProps) {
  const displayText = text.trim() || "(Paylaşım metni yok)";

  return (
    <Card className="p-5 transition hover:border-brand/30 hover:shadow-[0_8px_28px_rgba(109,94,247,0.14)]">
      <div className="flex gap-3">
        <Link href={`/clubs/${clubId}`} className="shrink-0">
          <ClubLogoAvatar
            name={clubName}
            logoKey={logoKey}
            logoUrl={logoUrl}
            size={40}
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Link
              href={`/clubs/${clubId}`}
              className="truncate text-base font-bold text-text hover:text-brand"
            >
              {clubName}
            </Link>
            {createdAtLabel && (
              <time className="shrink-0 text-xs font-medium text-text2">
                {createdAtLabel}
              </time>
            )}
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text">
            {displayText}
          </p>

          {hashtags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {hashtags.map((tag) => (
                <Chip key={tag} variant="brand">
                  #{tag.replace(/^#/, "")}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
