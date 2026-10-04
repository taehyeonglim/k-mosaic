import Link from 'next/link';

import { ko } from '@/content/ko';
import { fillTemplate } from '@/content/template';
import type { HeroTile } from '@/lib/data/hero';
import type { MetricKey } from '@/lib/schema';
import { formatMetricValue } from '@/lib/visualization/format';
import { onRampColor, rampColor, type RampStep } from '@/lib/visualization/scale';
import { TILE_COLUMNS, tileNameParts } from '@/lib/visualization/tile-layout';

export interface TileMosaicProps {
  tiles: readonly HeroTile[];
  metric: MetricKey;
}

const STEPS: RampStep[] = [1, 2, 3, 4, 5, 6, 7];

// 결측 — 가장 옅은 단계가 아니라 사선 패턴. 글자는 사선 위가 아니라 단색 바탕 위에 둔다.
// 사선 농도(55%)는 tests/unit/tokens.test.ts 의 HATCH_ALPHA 와 같아야 한다.
const HATCH =
  'repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--km-color-missing-stroke) 55%, transparent) 5px 6.5px)';

/**
 * 17개 시·도 타일 모자이크 — 잉크 띠 안에 놓는다 (램프는 다크 토큰).
 * 타일은 지역 페이지로 가는 링크다. SVG 를 쓰지 않는다 — 색과 사선은 CSS 배경.
 */
export function TileMosaic({ tiles, metric }: TileMosaicProps) {
  const hasMissing = tiles.some((tile) => tile.step === null);

  return (
    <nav aria-label={ko.mosaic.label} className="min-w-0">
      <p className="mb-2.5 text-small text-text-muted">
        {fillTemplate(ko.mosaic.caption, { metric: ko.filters.metrics[metric] })}
      </p>
      <ul
        className="grid gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${TILE_COLUMNS}, minmax(0, 1fr))` }}
      >
        {tiles.map((tile) => {
          const name = tileNameParts(tile.short, tile.officialKo);
          const missing = tile.step === null;
          return (
            <li className="min-w-0" key={tile.code}>
              <Link
                className="mosaic-tile"
                data-missing={missing || undefined}
                href={`/regions/${tile.code}/`}
                style={
                  tile.step === null
                    ? {
                        backgroundColor: 'var(--km-color-missing)',
                        backgroundImage: HATCH,
                        color: 'var(--km-color-text)',
                      }
                    : { backgroundColor: rampColor(tile.step), color: onRampColor(tile.step) }
                }
              >
                <span className="mosaic-tile-name">
                  {name.visible}
                  <span className="sr-only">{name.hiddenSuffix}</span>
                </span>
                <span className="mosaic-tile-value">
                  {formatMetricValue(metric, tile.value, ko.missing.value)}
                  {missing ? <span className="sr-only"> {ko.missing.ariaLabel}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* 작은 범례 — 장식. 정확한 구간과 결측 설명은 지도 범례에 있다. */}
      <div
        aria-hidden="true"
        className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[0.6875rem] text-text-muted"
      >
        <span className="flex items-center gap-2">
          {ko.mosaic.low[metric]}
          <span className="flex overflow-hidden rounded-full">
            {STEPS.map((step) => (
              <span className="h-2 w-5" key={step} style={{ backgroundColor: rampColor(step) }} />
            ))}
          </span>
          {ko.mosaic.high[metric]}
        </span>
        {hasMissing ? (
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-[0.1875rem]"
              style={{ backgroundColor: 'var(--km-color-missing)', backgroundImage: HATCH }}
            />
            {ko.missing.label}
          </span>
        ) : null}
      </div>
    </nav>
  );
}
