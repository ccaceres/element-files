interface SkeletonProps {
  rows?: number;
}

export function Skeleton({ rows = 8 }: SkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-10 animate-pulse rounded bg-app-surface"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

