import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title?: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section
      aria-live="polite"
      className="overflow-hidden rounded-[var(--km-radius-lg)] border border-dashed border-border bg-surface-muted/45 px-4 py-5 text-center sm:px-5"
      role="status"
    >
      {title ? <h2 className="text-base font-semibold text-text">{title}</h2> : null}
      <p className={`mx-auto max-w-prose text-sm leading-6 text-text-muted ${title ? 'mt-2' : ''}`}>
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}
