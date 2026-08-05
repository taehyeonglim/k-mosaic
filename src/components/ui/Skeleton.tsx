export interface SkeletonProps {
  width?: string;
  height?: string;
  count?: number;
}

export function Skeleton({ width, height, count }: SkeletonProps) {
  const skeletonCount =
    count === undefined ? 1 : Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;

  return (
    <div aria-hidden="true" className="grid min-w-0 gap-2">
      {Array.from({ length: skeletonCount }, (_, index) => (
        <span
          className="block max-w-full rounded-[var(--km-radius-sm)] bg-surface-muted animate-pulse motion-reduce:animate-none"
          key={index}
          style={{ height: height ?? '1rem', width: width ?? '100%' }}
        />
      ))}
    </div>
  );
}
