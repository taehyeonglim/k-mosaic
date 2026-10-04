import type { ReactNode } from 'react';

export interface BadgeProps {
  tone: 'neutral' | 'info' | 'caution';
  children: ReactNode;
}

const toneClassNames = {
  neutral: 'border-border bg-surface-muted text-text',
  info: 'border-transparent bg-accent/10 text-accent-strong',
  caution: 'viz-badge',
} satisfies Record<BadgeProps['tone'], string>;

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 ${toneClassNames[tone]}`}
      data-tone={tone}
    >
      {children}
    </span>
  );
}
