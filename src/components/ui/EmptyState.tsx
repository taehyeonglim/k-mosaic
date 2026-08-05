import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section
      aria-live="polite"
      className="relative overflow-hidden rounded-[var(--km-radius-lg)] border border-dashed border-border bg-surface-muted/45 p-6 text-center sm:p-8"
      role="status"
    >
      <div aria-hidden="true" className="mx-auto mb-4 grid w-fit grid-cols-3 gap-1 opacity-70">
        <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent" />
        <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent/45" />
        <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent/20" />
        <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent/20" />
        <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent/45" />
        <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent" />
      </div>
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-6 text-text-muted">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </section>
  );
}
