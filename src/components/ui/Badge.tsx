import type { ReactNode } from 'react';

export interface BadgeProps {
  tone: 'neutral' | 'info' | 'caution';
  children: ReactNode;
}

const toneClassNames = {
  neutral: 'border-border bg-surface-muted text-text',
  info: 'border-accent/45 bg-accent/10 text-accent-strong',
  caution: 'border-quality-note/55 bg-quality-note/10 text-quality-note',
} satisfies Record<BadgeProps['tone'], string>;

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-5 ${toneClassNames[tone]}`}
      data-tone={tone}
    >
      {children}
    </span>
  );
}
