import Link from 'next/link';

import ko from '@/content/ko';

export interface AppHeaderProps {
  brandName: string;
  brandSubtitle: string;
  dataYear: number;
  lastUpdated: string;
  sourceLabel: string;
  sourceHref: string;
}

export function AppHeader({
  brandName,
  brandSubtitle,
  dataYear,
  lastUpdated,
  sourceLabel,
  sourceHref,
}: AppHeaderProps) {
  const yearLabel = new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 0,
    useGrouping: false,
  }).format(dataYear);

  return (
    <header className="border-b border-border bg-surface">
      <div className="relative mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="relative min-w-0 pr-8">
          <div
            aria-hidden="true"
            className="absolute -right-1 top-1 grid grid-cols-3 gap-1 opacity-60"
          >
            <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent" />
            <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent/45" />
            <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent/20" />
            <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent/20" />
            <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent/45" />
            <span className="size-2 rounded-[var(--km-radius-sm)] bg-accent" />
          </div>
          <h1 className="break-words text-xl font-semibold leading-tight tracking-[0.08em] text-text sm:text-2xl">
            {brandName}
          </h1>
          <p className="mt-1 max-w-2xl break-words text-sm leading-5 text-text-muted">
            {brandSubtitle}
          </p>
        </div>

        {/* dl 의 div 그룹은 dt+dd 만 담아야 axe definition-list 규칙을 통과한다.
            구분점(·)은 DOM 노드가 아닌 CSS 의사요소로, 링크는 dl 밖 형제로 둔다. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-small lg:max-w-[42rem] lg:justify-end">
          <dl className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex min-w-0 items-baseline gap-1.5 after:ml-1.5 after:text-text-muted after:content-['·']">
              <dt className="text-text-muted">{ko.overview.referenceYear}</dt>
              <dd className="font-semibold tabular-nums text-text">{yearLabel}</dd>
            </div>
            <div className="flex min-w-0 items-baseline gap-1.5 after:ml-1.5 after:text-text-muted after:content-['·']">
              <dt className="text-text-muted">{ko.overview.updatedAt}</dt>
              <dd className="break-words font-semibold tabular-nums text-text">{lastUpdated}</dd>
            </div>
          </dl>
          {/* 일반 <a> 는 basePath(/k-mosaic)를 붙이지 않아 GitHub Pages 에서 404 가 난다.
              내부 경로는 반드시 next/link 를 쓴다 (해시 전용 href 도 Link 가 처리한다). */}
          <Link className="btn btn-ghost min-w-0 max-w-full break-words" href={sourceHref}>
            {sourceLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
