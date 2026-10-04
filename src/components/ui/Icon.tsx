import type { ReactNode } from 'react';

// 인라인 SVG 아이콘. 유니코드 문자(☀ ◐ ☾)는 글꼴마다 모양·굵기가 달라 쓰지 않는다.
// 아이콘은 언제나 장식이다 — 의미는 옆의 글자나 버튼의 aria-label 이 전한다.

export type IconName = 'sun' | 'system' | 'moon';

const SHAPES: Record<IconName, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  system: (
    <>
      <rect height="12" rx="2" width="18" x="3" y="4" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  moon: <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z" />,
};

export interface IconProps {
  name: IconName;
  /** 한 변의 길이(px) */
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      {SHAPES[name]}
    </svg>
  );
}
