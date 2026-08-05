export interface SkipLinkProps {
  targetId: string;
  label: string;
}

export function SkipLink({ targetId, label }: SkipLinkProps) {
  return (
    <a
      className="fixed left-4 top-4 z-[100] -translate-y-[200%] rounded-[var(--km-radius-md)] bg-accent-strong px-4 py-2 text-sm font-semibold text-canvas shadow-floating transition-transform duration-150 motion-reduce:transition-none focus-visible:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={`#${targetId}`}
    >
      {label}
    </a>
  );
}
