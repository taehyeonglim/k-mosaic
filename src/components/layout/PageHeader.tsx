import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** 제목 위의 페이지 동작 (돌아가기 링크 등) */
  actions?: ReactNode;
}

/**
 * 페이지 제목 — 대시보드가 아닌 페이지의 본문 맨 위. 잉크 띠에는 사이트 헤더만 두고
 * 페이지 제목은 밝은 본문에 둔다. h1 은 사이트 이름이므로 페이지 제목은 h2 다.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="min-w-0 space-y-3">
      {actions}
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-text sm:text-[1.75rem]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-text-muted">{description}</p>
        ) : null}
      </div>
    </header>
  );
}
