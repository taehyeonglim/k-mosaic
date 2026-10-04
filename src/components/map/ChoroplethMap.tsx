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
  remoteIslandGroups,
  splitKoreaGeo,
  toD3Winding,
} from '@/lib/visualization/projection';
import type { ColorScale } from '@/lib/visualization/scale';

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

const INITIAL_DIMENSIONS: Dimensions = { width: 720, height: 634 };

function dimensionsForWidth(width: number): Dimensions {
  const safeWidth = Math.max(1, width);
  return {
    width: safeWidth,
    height: Math.max(280, Math.min(900, safeWidth * 0.88)),
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
  const islandGroups = useMemo(() => remoteIslandGroups(geoParts.inset), [geoParts]);
  // 겹쳐 그리는 외곽선(호버·선택·포커스)용 경로. 지역 path 뒤에 그려야 이웃 지역에 가리지 않는다.
  const outlinePath = (code: string | null): string => {
    if (code === null) return '';
    const feature = mainFeatureByCode.get(code);
    return feature === undefined ? '' : (pathGenerator(feature) ?? '');
  };
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
            const mainFeature = mainFeatureByCode.get(code);
            const pathData = mainFeature === undefined ? '' : (pathGenerator(mainFeature) ?? '');
            const ariaValue = value === null ? missingLabel : formatValue(value);
            const ariaRank = rank === null ? missingLabel : rank;
            const insetNote = insetFeatureCodes.has(code) ? ko.map.insetAriaNote : '';

            return (
              <path
                key={code}
                d={pathData}
                tabIndex={0}
                role="button"
                aria-label={`${label}, ${metricLabel}: ${ariaValue}, ${ko.filters.year} ${year}, ${ko.ranking.rank} ${ariaRank}${insetNote}`}
                aria-pressed={selected}
                aria-describedby={activeCode === code ? tooltipId : undefined}
                fill={value === null ? `url(#${patternId})` : scale.color(value)}
                stroke="var(--km-color-surface)"
                strokeWidth={1}
                strokeLinejoin="round"
                onClick={() => onSelectRegion(selected ? null : code)}
                onKeyDown={(event) => handleKeyDown(event, code)}
                onMouseEnter={() => setHoveredRegion(code)}
                onMouseLeave={() => setHoveredRegion(null)}
                // 포커스 링은 키보드 포커스에만 그린다 — 마우스로 누른 뒤에는 선택 링이 보여야 한다.
                onFocus={(event) => {
                  if (event.currentTarget.matches(':focus-visible')) setFocusedRegion(code);
                }}
                onBlur={() => setFocusedRegion(null)}
                style={{ cursor: 'pointer', outline: 'none' }}
              />
            );
          })}
        </g>
        {/* 겹쳐 그리는 외곽선 — 장식이므로 보조기술에 노출하지 않고 클릭을 가로채지 않는다.
            강조 보라만으로는 가장 짙은 단계 위에서 1.9:1 이라, 표면색 헤일로를 먼저 깐다. */}
        <g aria-hidden="true" fill="none" pointerEvents="none" strokeLinejoin="round">
          {hoveredRegion !== null && hoveredRegion !== selectedRegion ? (
            <path d={outlinePath(hoveredRegion)} stroke="var(--km-color-text)" strokeWidth={1.5} />
          ) : null}
          {selectedRegion !== null ? (
            <>
              <path
                aria-hidden="true"
                d={outlinePath(selectedRegion)}
                data-map-selection="halo"
                stroke="var(--km-color-surface)"
                strokeWidth={6}
              />
              <path
                aria-hidden="true"
                d={outlinePath(selectedRegion)}
                data-map-selection="ring"
                stroke="var(--km-color-accent2)"
                strokeWidth={2.5}
              />
            </>
          ) : null}
          {focusedRegion !== null ? (
            <>
              <path
                d={outlinePath(focusedRegion)}
                stroke="var(--km-color-surface)"
                strokeWidth={7}
              />
              <path d={outlinePath(focusedRegion)} stroke="var(--km-color-focus)" strokeWidth={3} />
            </>
          ) : null}
        </g>
        {projectionLayout.insetBox !== null && insetPathGenerator !== null ? (
          <g role="group" aria-label={ko.map.insetGroupLabel} pointerEvents="none">
            <desc id={insetNoticeId}>{ko.map.insetDescription}</desc>
            <rect
              x={projectionLayout.insetBox.x}
              y={projectionLayout.insetBox.y}
              width={projectionLayout.insetBox.width}
              height={projectionLayout.insetBox.height}
              rx="8"
              fill="var(--km-color-surface-muted)"
              stroke="var(--km-color-border)"
              strokeWidth="1"
            />
            <text
              x={projectionLayout.insetBox.x + 8}
              y={projectionLayout.insetBox.y + 15}
              fill="var(--km-color-text-muted)"
              fontSize="10.5"
              fontWeight="500"
            >
              <tspan x={projectionLayout.insetBox.x + 8} dy="0">
                {ko.map.insetTitle}
              </tspan>
              <tspan x={projectionLayout.insetBox.x + 8} dy="13">
                {ko.map.insetSubtitle}
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
                  aria-hidden="true"
                />
              );
            })}
            {/* 섬 이름표 — 섬이 작아 상자가 비어 보이므로 무엇이 그려져 있는지 적는다.
                독도는 1px 이 안 되어 표식(점)을 함께 둔다. */}
            {islandGroups.map((group) => {
              const [[left, top], [right, bottom]] = insetPathGenerator.bounds(group.geometry);
              const centerX = (left + right) / 2;
              const centerY = (top + bottom) / 2;
              const code = geoParts.inset.features[0]?.properties?.regionCode ?? '';
              const value = dataByCode.get(code) ?? null;
              const isDokdo = group.id === 'dokdo';
              return (
                <g key={group.id}>
                  {isDokdo ? (
                    <circle
                      aria-hidden="true"
                      cx={centerX}
                      cy={centerY}
                      r={2.5}
                      fill={value === null ? 'var(--km-color-missing-stroke)' : scale.color(value)}
                    />
                  ) : null}
                  <text
                    x={isDokdo ? centerX - 6 : right + 5}
                    y={centerY + 3.5}
                    fill="var(--km-color-text)"
                    fontSize="10.5"
                    fontWeight="600"
                    textAnchor={isDokdo ? 'end' : 'start'}
                  >
                    {ko.map.insetIslands[group.id]}
                  </text>
                </g>
              );
            })}
          </g>
        ) : null}
      </svg>

      {activeCode !== null ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] rounded-[var(--km-radius-md)] border border-border bg-surface px-3 py-2 text-sm shadow-floating"
        >
          <div className="font-semibold">{activeLabel}</div>
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
        <p>{ko.common.geoSourceAttribution}</p>
        <p>{ko.common.geoProcessingAttribution}</p>
      </footer>
    </div>
  );
}
