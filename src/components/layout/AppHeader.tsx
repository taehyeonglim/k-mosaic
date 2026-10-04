import Link from 'next/link';
import type { ReactNode } from 'react';

import ko from '@/content/ko';
import { SkipLink } from './SkipLink';
import { ThemeToggle } from './ThemeToggle';

export type NavKey = 'multicultural' | 'foreignStudents' | 'sources';

const NAV_ITEMS: { key: NavKey; href: string; label: string }[] = [
  { key: 'multicultural', href: '/', label: ko.nav.multicultural },
  { key: 'foreignStudents', href: '/foreign-students/', label: ko.nav.foreignStudents },
  { key: 'sources', href: '/sources/', label: ko.nav.sources },
];

export interface AppHeaderProps {
  brandName: string;
  brandSubtitle: string;
  /** 주요 메뉴에서 현재 위치로 표시할 항목. 404·오류 화면처럼 해당이 없으면 생략한다. */
  current?: NavKey;
  /** 'section' 은 메뉴 항목 자체가 아니라 그 아래의 하위 페이지(지역 페이지)라는 뜻이다. */
  currentScope?: 'page' | 'section';
  dataYear?: number;
  lastUpdated?: string;
  /** 건너뛰기 링크의 목적지 */
  skipTargetId?: string;
  /** 잉크 띠 안, 헤더 아래에 이어지는 내용 (대시보드 히어로) */
  children?: ReactNode;
}

/** 로고 — 서로 다른 타일 넷이 한 면을 이루는 모자이크 (docs/design-system.md §1.1). */
function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      focusable="false"
      height="30"
      viewBox="0 0 30 30"
      width="30"
    >
      <rect className="fill-ramp-6" height="13" rx="3.5" width="13" x="1" y="1" />
      <rect className="fill-ramp-4" height="13" rx="3.5" width="13" x="16" y="1" />
      <rect className="fill-accent2" height="13" rx="3.5" width="13" x="1" y="16" />
      <rect className="fill-ramp-5" height="13" rx="3.5" width="13" x="16" y="16" />
    </svg>
  );
}

export function AppHeader({
  brandName,
  brandSubtitle,
  current,
  currentScope = 'page',
  dataYear,
  lastUpdated,
  skipTargetId = 'main-content',
  children,
}: AppHeaderProps) {
  const yearLabel =
    dataYear === undefined
      ? null
      : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0, useGrouping: false }).format(
          dataYear,
        );
  // 좁은 화면에서는 두 줄로 쌓고, 넓어지면 한 줄에 구분점(·)을 둔다.
  const metaGroup =
    "flex min-w-0 items-baseline gap-1.5 sm:[&:not(:last-child)]:after:ml-1 sm:[&:not(:last-child)]:after:text-text-muted sm:[&:not(:last-child)]:after:content-['·']";

  return (
    // 잉크 띠 안에서는 테마와 무관하게 다크 토큰이 적용된다 (globals.css 의 .ink-band).
    <div className="ink-band font-sans">
      <SkipLink label={ko.nav.skipToContent} targetId={skipTargetId} />
      <header>
        <div className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex w-full min-w-0 items-center gap-3 xl:w-auto">
            <BrandMark />
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight tracking-[0.1em] text-text">
                {/* 일반 <a> 는 basePath(/k-mosaic)를 붙이지 않아 GitHub Pages 에서 404 가 난다.
                    내부 경로는 반드시 next/link 를 쓴다. */}
                <Link
                  className="rounded-[var(--km-radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                  href="/"
                >
                  {brandName}
                </Link>
              </h1>
              <p className="mt-0.5 break-words text-small text-text-muted">{brandSubtitle}</p>
            </div>
          </div>

          <nav aria-label={ko.nav.primaryLabel} className="w-full min-w-0 md:w-auto xl:mx-auto">
            <ul className="flex flex-wrap gap-1 rounded-[1.375rem] border border-border bg-ink-raised p-1 md:inline-flex md:flex-nowrap">
              {NAV_ITEMS.map((item) => {
                const isCurrent = item.key === current;
                return (
                  <li className="flex flex-auto" key={item.key}>
                    <Link
                      aria-current={
                        isCurrent ? (currentScope === 'section' ? 'true' : 'page') : undefined
                      }
                      className={`inline-flex min-h-9 w-full items-center justify-center whitespace-nowrap rounded-full px-2.5 text-[0.8125rem] transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:px-4 sm:text-sm ${
                        isCurrent
                          ? 'bg-text font-semibold text-ink'
                          : 'font-medium text-text-muted hover:bg-surface-muted hover:text-text'
                      }`}
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex w-full min-w-0 items-center gap-x-4 md:ml-auto md:w-auto xl:ml-0">
            {/* dl 의 div 그룹은 dt+dd 만 담아야 axe definition-list 규칙을 통과한다.
                구분점(·)은 DOM 노드가 아닌 CSS 의사요소로 둔다. */}
            {yearLabel !== null || lastUpdated !== undefined ? (
              <dl className="flex min-w-0 flex-col gap-x-2.5 gap-y-0.5 text-small sm:flex-row sm:flex-wrap sm:items-center">
                {yearLabel !== null ? (
                  <div className={metaGroup}>
                    <dt className="text-text-muted">{ko.overview.referenceYear}</dt>
                    <dd className="font-semibold text-text">{yearLabel}</dd>
                  </div>
                ) : null}
                {lastUpdated !== undefined ? (
                  <div className={metaGroup}>
                    <dt className="text-text-muted">{ko.overview.updatedAt}</dt>
                    <dd className="break-words font-semibold text-text">{lastUpdated}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <div className="ml-auto shrink-0">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
