import type { ReactNode } from 'react';

export interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, description, children, className }: CardProps) {
  return (
    <section
      className={`relative min-w-0 overflow-hidden rounded-[var(--km-radius-lg)] border border-border bg-surface p-5 shadow-card sm:p-6 ${className ?? ''}`}
    >
      {title || description ? (
        <header className="relative mb-4 min-w-0">
          {title ? (
            <h2 className="text-title font-semibold tracking-tight text-text">{title}</h2>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>
          ) : null}
        </header>
      ) : null}

      <div className="relative min-w-0">{children}</div>
    </section>
  );
}
