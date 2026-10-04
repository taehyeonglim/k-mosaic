import type { ReactNode } from 'react';

export interface CardProps {
  title?: string;
  description?: string;
  /** 제목 오른쪽의 짧은 보조 정보 (예: 지도의 '학생 수 · 2025') */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 패널 — 캔버스 위의 흰 면. 안쪽 구획은 테두리가 아니라 한 단계 어두운 면(.card)으로 나눈다. */
export function Card({ title, description, meta, children, className }: CardProps) {
  return (
    <section
      className={`relative min-w-0 overflow-hidden rounded-[var(--km-radius-lg)] border border-border bg-surface p-5 shadow-card sm:p-6 ${className ?? ''}`}
    >
      {title || description ? (
        <header className="relative mb-4 min-w-0">
          {title ? (
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="panel-title">{title}</h2>
              {meta ? <p className="text-small text-text-muted">{meta}</p> : null}
            </div>
          ) : null}
          {description ? (
            <p className={`text-sm leading-6 text-text-muted ${title ? 'mt-1.5' : ''}`}>
              {description}
            </p>
          ) : null}
        </header>
      ) : null}

      <div className="relative min-w-0">{children}</div>
    </section>
  );
}
