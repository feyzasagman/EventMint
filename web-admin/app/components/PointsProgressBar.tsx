type PointsProgressBarProps = {
  points: number;
  goal?: number;
};

export function PointsProgressBar({ points, goal = 100 }: PointsProgressBarProps) {
  const safe = Math.max(0, points);
  const percent = Math.min(100, (safe / goal) * 100);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-text2">Puan ilerlemesi</span>
        <span className="font-semibold text-text">
          {safe} / {goal}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-border bg-surface2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-brand/70 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
