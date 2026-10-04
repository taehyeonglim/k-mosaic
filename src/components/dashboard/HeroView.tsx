import Link from 'next/link';

import { TileMosaic } from '@/components/map/TileMosaic';
import { DeltaValue } from '@/components/ui/DeltaValue';
import { MetricValue } from '@/components/ui/MetricValue';
import { ko } from '@/content/ko';
import { fillTemplate } from '@/content/template';
import type { HeroData } from '@/lib/data/hero';

export interface HeroViewProps {
  hero: HeroData;
  /** 정적 HTML 에 들어가는 기본 화면 — 주소에 다른 필터가 있으면 가려 둔다 (globals.css). */
  fallback?: boolean;
}

// 보조 지표 타일 — 좁은 화면에서는 이름표(왼쪽)와 값(오른쪽)을 한 줄에 두어 높이를 줄이고,
// 넓어지면 위아래로 쌓는다. DOM 순서(이름표 → 값 → 주석)는 같다.
const TILE =
  'viz-stat min-w-0 !grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 rounded-[var(--km-radius-md)] border border-border bg-ink-raised/70 px-4 py-3 sm:!flex sm:gap-1.5';
const TILE_LABEL = 'text-small text-text-muted';
const TILE_VALUE = 'viz-stat-value text-metric-md';
const TILE_NOTE = 'col-start-1 text-small text-text-muted';

/**
 * 히어로 — 전국 개요(큰 수치 + 보조 지표)와 17개 시·도 타일 모자이크.
 *
 * 훅을 쓰지 않는 순수 표현 컴포넌트다. 서버는 기본 필터의 화면을 정적 HTML 에 넣고
 * (Suspense fallback), 클라이언트는 URL 필터로 같은 컴포넌트를 다시 그린다.
 * 잉크 띠 안에 놓이므로 색은 테마와 무관하게 다크 토큰이다.
 */
export function HeroView({ hero, fallback = false }: HeroViewProps) {
  const numberFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });

  return (
    <div
      className="mx-auto grid w-full max-w-[1440px] min-w-0 gap-x-12 gap-y-9 px-4 pb-10 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-center lg:px-8 lg:pb-14 lg:pt-8"
      data-hero-fallback={fallback || undefined}
    >
      <section
        aria-label={ko.overview.title}
        className="min-w-0 outline-none"
        id="overview"
        tabIndex={-1}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-text">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-[0.1875rem] bg-accent" />
          <h2 className="font-semibold">{ko.overview.title}</h2>
          <span className="text-text-muted">
            · {fillTemplate(ko.overview.asOf, { year: hero.year })}
            {hero.level === 'all' ? null : ` · ${ko.filters.schoolLevels[hero.level]}`}
          </span>
        </div>

        <article className="viz-stat mt-5 gap-1" data-key="student-count" data-unit="count">
          <p className={TILE_LABEL}>{ko.overview.countLabel}</p>
          {/* 큰 단독 숫자 — 비례폭, 단위는 작게. 숫자와 단위가 한 요소 안에 있어야 한다
              (화면낭독기가 한 번에 읽고, 테스트가 '202,208명' 으로 찾는다). */}
          <p className="viz-stat-value text-hero leading-none tracking-[-0.03em]">
            {hero.count === null ? (
              <span aria-label={ko.missing.ariaLabel} data-missing="true">
                {ko.missing.value}
              </span>
            ) : (
              <span className="whitespace-nowrap">
                <span>{numberFormat.format(hero.count)}</span>
                <span className="ml-1 text-[0.36em] font-semibold tracking-normal">
                  {ko.units.count}
                </span>
              </span>
            )}
          </p>
        </article>

        <div className="mt-6 grid min-w-0 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:max-w-2xl">
          <article className={TILE} data-key="student-rate" data-unit="percent">
            <p className={TILE_LABEL}>
              {ko.overview.nationwideValue} · {ko.overview.rate}
            </p>
            <div className={TILE_VALUE}>
              <MetricValue
                value={hero.rate}
                unit="percent"
                size="md"
                missingLabel={ko.missing.ariaLabel}
              />
            </div>
            <p className={TILE_NOTE}>{ko.overview.computedRate}</p>
          </article>
          <article className={TILE} data-key="previous-year" data-unit="count">
            <p className={TILE_LABEL}>{ko.overview.previousYear}</p>
            <div className={TILE_VALUE}>
              <DeltaValue
                delta={hero.previousDelta}
                deltaPct={hero.previousDeltaPct}
                unit="count"
              />
            </div>
          </article>
          <article className={TILE} data-key="first-year" data-unit="count">
            <p className={TILE_LABEL}>
              {hero.baselineYear === null
                ? ko.overview.firstYear
                : fillTemplate(ko.overview.sinceYear, { year: hero.baselineYear })}
            </p>
            <div className={TILE_VALUE}>
              <DeltaValue delta={hero.baselineDelta} deltaPct={null} unit="count" />
            </div>
          </article>
        </div>

        <p className="mt-6 max-w-2xl text-sm leading-6 text-text-muted">
          {ko.app.tagline} {/* 해시 전용 href 도 next/link 가 처리한다 (basePath 유지). */}
          <Link
            className="whitespace-nowrap font-medium text-text underline decoration-border-strong underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href="#about-term"
          >
            {ko.ethics.termTitle}
          </Link>
        </p>
      </section>

      <TileMosaic tiles={hero.tiles} metric={hero.metric} />
    </div>
  );
}
