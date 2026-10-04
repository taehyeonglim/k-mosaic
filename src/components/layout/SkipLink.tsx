export interface SkipLinkProps {
  targetId: string;
  label: string;
}

/** 잉크 띠 안에 두므로 색은 테마와 무관하게 다크 토큰이다 — 밝은 면에 잉크색 글자. */
export function SkipLink({ targetId, label }: SkipLinkProps) {
  return (
    <a
      className="fixed left-4 top-4 z-[100] -translate-y-[200%] rounded-full bg-text px-4 py-2 text-sm font-semibold text-ink shadow-floating transition-transform duration-150 motion-reduce:transition-none focus-visible:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={`#${targetId}`}
    >
      {label}
    </a>
  );
}
