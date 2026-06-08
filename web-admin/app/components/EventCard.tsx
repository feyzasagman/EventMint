import Link from "next/link";
import { Card } from "./ui/card";
import { Chip } from "./ui/chip";

export type EventCardProps = {
  title?: string;
  description?: string;
  clubId?: string;
  category?: string;
  location?: string;
  tags?: string[];
  href?: string;
  actions?: React.ReactNode;
};

export function EventCard({
  title,
  description,
  clubId,
  category,
  location,
  tags = [],
  href,
  actions,
}: EventCardProps) {
  const visibleTags = tags.slice(0, 2);
  const hiddenTagCount = tags.length - visibleTags.length;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="line-clamp-2 text-lg font-semibold tracking-tight">
          {title || "Untitled Event"}
        </h2>
        <Chip variant="brand" className="shrink-0">
          {category || "-"}
        </Chip>
      </div>

      {description && (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {description}
        </p>
      )}

      <div className="mt-4 grid gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden>👥</span> {clubId || "-"}
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden>📍</span> {location || "-"}
        </span>
      </div>
    </>
  );

  return (
    <Card className={`flex min-h-60 flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md ${href ? "cursor-pointer" : ""}`}>
      {href ? (
        <Link href={href} className="block flex-1 text-inherit no-underline">
          {body}
        </Link>
      ) : (
        body
      )}

      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <div className="flex flex-wrap gap-2">
          {visibleTags.map((tag) => (
            <Chip key={tag}>
              {tag}
            </Chip>
          ))}
          {hiddenTagCount > 0 && (
            <Chip className="text-zinc-500 dark:text-zinc-400">
              +{hiddenTagCount}
            </Chip>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center justify-end gap-2">{actions}</div>}
      </div>
    </Card>
  );
}
