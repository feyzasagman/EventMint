export function EmptyState({
  icon = "◌",
  title,
  subtitle,
  action,
}: {
  icon?: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl dark:bg-indigo-950">
        <span aria-hidden>{icon}</span>
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        {subtitle}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
