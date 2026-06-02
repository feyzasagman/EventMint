"use client";

type NoticeTone = "success" | "error" | "info";

const toneStyles: Record<NoticeTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  info: "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300",
};

export function InlineNotice({
  message,
  tone = "info",
}: {
  message: string;
  tone?: NoticeTone;
}) {
  return (
    <p className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${toneStyles[tone]}`}>
      {message}
    </p>
  );
}
