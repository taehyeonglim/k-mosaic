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
      className={`relative min-w-0 overflow-hidden rounded-[var(--km-radius-lg)] border border-border bg-surface p-4 shadow-card sm:p-5 ${className ?? ''}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-4 grid grid-cols-3 gap-1 opacity-45"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <span
            className={`size-2 rounded-[var(--km-radius-sm)] ${index % 3 === 0 ? 'bg-accent' : 'bg-accent/35'}`}
            key={index}
          />
        ))}
      </div>

      {title || description ? (
        <header className="relative mb-4 min-w-0 pr-10">
          {title ? (
            <h2 className="text-base font-semibold tracking-tight text-text">{title}</h2>
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
