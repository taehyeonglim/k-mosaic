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
      <div className="relative mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
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
          <h1 className="break-words text-xl font-semibold tracking-[0.08em] text-text sm:text-2xl">
            {brandName}
          </h1>
          <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-text-muted">
            {brandSubtitle}
          </p>
        </div>

        <dl className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-3 sm:gap-5 lg:min-w-[30rem]">
          <div className="min-w-0 border-l-2 border-accent/45 pl-3">
            <dt className="text-text-muted">{ko.overview.referenceYear}</dt>
            <dd className="mt-1 font-semibold tabular-nums text-text">{yearLabel}</dd>
          </div>
          <div className="min-w-0 border-l-2 border-border pl-3">
            <dt className="text-text-muted">{ko.overview.updatedAt}</dt>
            <dd className="mt-1 break-words font-medium tabular-nums text-text">{lastUpdated}</dd>
          </div>
          <div className="min-w-0 border-l-2 border-border pl-3">
            <dt className="text-text-muted">{ko.nav.sources}</dt>
            <dd className="mt-1 min-w-0 break-words font-medium">
              <a
                className="break-words text-accent-strong underline decoration-accent/50 underline-offset-4 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                href={sourceHref}
              >
                {sourceLabel}
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
