'use client';

import { geoPath } from 'd3-geo';
import type { ExtendedFeatureCollection as FeatureCollection } from 'd3-geo';
import { useId, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import {
  ChartDataTable,
  type ChartDataTableColumn,
  type ChartDataTableRow,
} from '@/components/charts/ChartDataTable';
import { ko } from '@/content/ko';
import {
  createKoreaProjectionLayout,
  splitKoreaGeo,
  toD3Winding,
} from '@/lib/visualization/projection';
import type { ColorScale } from '@/lib/visualization/scale';

const GEO_SOURCE_ATTRIBUTION = '행정경계: 통계청 통계지리정보서비스(SGIS) — 공공누리 제1유형';
const GEO_PROCESSING_ATTRIBUTION = '가공: vuski/admdongkor — CC BY 4.0';

export interface ChoroplethMapProps {
  geo: FeatureCollection;
  data: { regionCode: string; value: number | null }[];
  scale: ColorScale;
  selectedRegion: string | null;
  onSelectRegion(code: string | null): void;
  formatValue(v: number | null): string;
  regionLabels: Record<string, string>;
  ranks: Record<string, number | null>;
  year: number;
  metricLabel: string;
  missingLabel: string;
}

interface Dimensions {
  width: number;
  height: number;
}

const INITIAL_DIMENSIONS: Dimensions = { width: 720, height: 760 };

function dimensionsForWidth(width: number): Dimensions {
  const safeWidth = Math.max(1, width);
  return {
    width: safeWidth,
    height: Math.max(280, Math.min(900, safeWidth + 40)),
  };
}

export function ChoroplethMap({
  geo,
  data,
  scale,
  selectedRegion,
  onSelectRegion,
  formatValue,
  regionLabels,
  ranks,
  year,
  metricLabel,
  missingLabel,
}: ChoroplethMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>(INITIAL_DIMENSIONS);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [focusedRegion, setFocusedRegion] = useState<string | null>(null);
  const mapId = useId().replaceAll(':', '');
  const patternId = `map-missing-${mapId}`;
  const tooltipId = `map-tooltip-${mapId}`;
  const insetNoticeId = `map-inset-notice-${mapId}`;

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }

    const updateDimensions = () => {
      const width = element.getBoundingClientRect().width;
      if (width > 0) {
        setDimensions(dimensionsForWidth(width));
      }
    };

    updateDimensions();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // d3-geo 는 시계 방향 외곽 링을 기대한다 (RFC 7946 과 반대).
  // 변환하지 않으면 각 지역 path 에 clipExtent 사각형이 덧붙어 지도가 통째로 덮인다.
  const d3Geo = useMemo(() => toD3Winding(geo), [geo]);
  const geoParts = useMemo(() => splitKoreaGeo(d3Geo), [d3Geo]);

  const features = useMemo(
    () =>
      [...d3Geo.features].sort((first, second) => {
        const firstCode = first.properties?.regionCode ?? '';
        const secondCode = second.properties?.regionCode ?? '';
        return firstCode.localeCompare(secondCode);
      }),
    [d3Geo],
  );
  const mainFeatureByCode = useMemo(
    () =>
      new Map(
        geoParts.main.features.map((feature) => [feature.properties?.regionCode ?? '', feature]),
      ),
    [geoParts],
  );
  const dataByCode = useMemo(
    () => new Map(data.map((item) => [item.regionCode, item.value])),
    [data],
  );
  const projectionLayout = useMemo(
    () => createKoreaProjectionLayout(d3Geo, dimensions.width, dimensions.height),
    [dimensions, d3Geo],
  );
  const pathGenerator = useMemo(() => geoPath(projectionLayout.main), [projectionLayout.main]);
  const insetPathGenerator = useMemo(
    () => (projectionLayout.inset === null ? null : geoPath(projectionLayout.inset)),
    [projectionLayout.inset],
  );
  const insetFeatureCodes = useMemo(
    () => new Set(geoParts.inset.features.map((feature) => feature.properties?.regionCode ?? '')),
    [geoParts],
  );
  const activeRegion = hoveredRegion ?? focusedRegion;
  const activeFeature = features.find((feature) => feature.properties?.regionCode === activeRegion);
  const activeCode = activeFeature?.properties?.regionCode ?? null;
  const activeValue = activeCode === null ? null : (dataByCode.get(activeCode) ?? null);
  const activeLabel = activeCode === null ? '' : (regionLabels[activeCode] ?? activeCode);
  const activeRank = activeCode === null ? null : (ranks[activeCode] ?? null);

  const tableColumns: ChartDataTableColumn[] = [
    { key: 'region', label: ko.ranking.region },
    { key: 'value', label: metricLabel },
    { key: 'year', label: ko.filters.year, numeric: true },
    { key: 'rank', label: ko.ranking.rank, numeric: true },
  ];
  const tableRows: ChartDataTableRow[] = features.map((feature) => {
    const code = feature.properties?.regionCode ?? '';
    const value = dataByCode.get(code) ?? null;
    const rank = ranks[code] ?? null;
    return {
      id: code,
      region: regionLabels[code] ?? feature.properties?.nameKo ?? code,
      value: formatValue(value),
      year,
      rank: rank === null ? missingLabel : rank,
    };
  });

  function handleKeyDown(event: ReactKeyboardEvent<SVGPathElement>, code: string) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setFocusedRegion(null);
      onSelectRegion(null);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      onSelectRegion(selectedRegion === code ? null : code);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        className="block h-auto w-full overflow-visible"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        role="group"
        aria-label={metricLabel}
        aria-describedby={projectionLayout.insetBox === null ? undefined : insetNoticeId}
      >
        <defs>
          <pattern
            id={patternId}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(0)"
          >
            <rect width="8" height="8" fill={scale.missingColor} />
            <path
              d="M-2,2 L2,-2 M0,8 L8,0 M6,10 L10,6"
              stroke="var(--km-color-missing-stroke, currentColor)"
              strokeWidth="1.5"
              fill="none"
            />
          </pattern>
        </defs>
        <g>
          {features.map((feature) => {
            const code = feature.properties?.regionCode ?? '';
            const value = dataByCode.get(code) ?? null;
            const label = regionLabels[code] ?? feature.properties?.nameKo ?? code;
            const rank = ranks[code] ?? null;
            const selected = selectedRegion === code;
            const focused = focusedRegion === code;
            const mainFeature = mainFeatureByCode.get(code);
            const pathData = mainFeature === undefined ? '' : (pathGenerator(mainFeature) ?? '');
            const ariaValue = value === null ? missingLabel : formatValue(value);
            const ariaRank = rank === null ? missingLabel : rank;
            const insetNote = insetFeatureCodes.has(code)
              ? ', 울릉도·독도는 실제 위치가 아닌 인셋으로 표시'
              : '';

            return (
              <g key={code}>
                <path
                  d={pathData}
                  tabIndex={0}
                  role="button"
                  aria-label={`${label}, ${metricLabel}: ${ariaValue}, ${ko.filters.year} ${year}, ${ko.ranking.rank} ${ariaRank}${insetNote}`}
                  aria-pressed={selected}
                  aria-describedby={activeCode === code ? tooltipId : undefined}
                  fill={value === null ? `url(#${patternId})` : scale.color(value)}
                  stroke={
                    selected
                      ? 'var(--km-color-accent-strong, currentColor)'
                      : 'var(--km-color-border, currentColor)'
                  }
                  strokeWidth={selected ? 2.5 : 0.8}
                  onClick={() => onSelectRegion(selected ? null : code)}
                  onKeyDown={(event) => handleKeyDown(event, code)}
                  onMouseEnter={() => setHoveredRegion(code)}
                  onMouseLeave={() => setHoveredRegion(null)}
                  onFocus={() => setFocusedRegion(code)}
                  onBlur={() => setFocusedRegion(null)}
                  style={{ cursor: 'pointer' }}
                />
                {focused ? (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="var(--km-color-focus, currentColor)"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    pointerEvents="none"
                    aria-hidden="true"
                  />
                ) : null}
              </g>
            );
          })}
        </g>
        {projectionLayout.insetBox !== null && insetPathGenerator !== null ? (
          <g
            role="group"
            aria-label="울릉도·독도 인셋 — 실제 위치가 아닌 확대 표현입니다."
            pointerEvents="none"
          >
            <desc id={insetNoticeId}>
              울릉도와 독도는 본토와 실제 위치 관계를 유지한 지도가 아니라, 식별을 위한 인셋으로
              확대해 표시합니다.
            </desc>
            <rect
              x={projectionLayout.insetBox.x}
              y={projectionLayout.insetBox.y}
              width={projectionLayout.insetBox.width}
              height={projectionLayout.insetBox.height}
              rx="4"
              fill="var(--km-color-surface, white)"
              stroke="var(--km-color-border, currentColor)"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
            <text
              x={projectionLayout.insetBox.x + 8}
              y={projectionLayout.insetBox.y + 15}
              fill="var(--km-color-text, currentColor)"
              fontSize="11"
              fontWeight="600"
            >
              <tspan x={projectionLayout.insetBox.x + 8} dy="0">
                도서 인셋
              </tspan>
              <tspan x={projectionLayout.insetBox.x + 8} dy="13">
                실제 위치 아님
              </tspan>
            </text>
            {geoParts.inset.features.map((feature) => {
              const code = feature.properties?.regionCode ?? '';
              const value = dataByCode.get(code) ?? null;
              const insetPath = insetPathGenerator(feature) ?? '';
              return (
                <path
                  key={`inset-${code}`}
                  d={insetPath}
                  fill={value === null ? `url(#${patternId})` : scale.color(value)}
                  stroke="var(--km-color-border, currentColor)"
                  strokeWidth="1"
                  aria-hidden="true"
                />
              );
            })}
          </g>
        ) : null}
      </svg>

      {activeCode !== null ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] rounded border border-[var(--km-color-border)] bg-[var(--km-color-surface)] px-3 py-2 text-sm shadow-sm"
        >
          <div className="font-medium">{activeLabel}</div>
          <div className="tabular-nums">
            {metricLabel}: {activeValue === null ? missingLabel : formatValue(activeValue)}
          </div>
          <div className="tabular-nums">
            {ko.filters.year}: {year} · {ko.ranking.rank}:{' '}
            {activeRank === null ? missingLabel : activeRank}
          </div>
        </div>
      ) : null}

      <div className="sr-only">
        <ChartDataTable
          caption={metricLabel}
          columns={tableColumns}
          rows={tableRows}
          visuallyHidden
        />
      </div>

      <footer className="mt-2 text-small text-[var(--km-color-text-muted)]">
        <p>{GEO_SOURCE_ATTRIBUTION}</p>
        <p>{GEO_PROCESSING_ATTRIBUTION}</p>
      </footer>
    </div>
  );
}
