'use client';

import ko from '@/content/ko';

export interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?(): void;
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <section
      aria-live="assertive"
      className="rounded-[var(--km-radius-lg)] border border-border bg-surface p-6 shadow-card"
      role="alert"
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">{description}</p>
        </div>
        {onRetry ? (
          <button
            aria-label={ko.errors.generic}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--km-radius-md)] border border-border bg-surface text-lg text-text transition-colors duration-150 hover:bg-surface-muted motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            onClick={onRetry}
            title={ko.errors.generic}
            type="button"
          >
            <span aria-hidden="true">↻</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
