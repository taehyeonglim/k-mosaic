'use client';

import dynamic from 'next/dynamic';

import { Card } from '@/components/ui/Card';
import { ko } from '@/content/ko';
import type { ChoroplethMapProps } from './ChoroplethMap';
import { MapLegend } from './MapLegend';

// 단계구분도 카드 — 지도 · 범례 · 조작 안내 · 비교 지역 초과 경고.
// 다문화학생과 외국인 유학생 페이지가 같은 구조를 따로 들고 있던 것을 하나로 묶었다.

const ChoroplethMap = dynamic(
  () => import('./ChoroplethMap').then((module) => module.ChoroplethMap),
  {
    ssr: false,
    loading: () => <p className="text-small text-[var(--km-color-text-muted)]">{ko.map.title}</p>,
  },
);

export interface RegionMapCardProps extends ChoroplethMapProps {
  title: string;
  description: string;
  /** 지도 아래 안내 문장 (키보드 조작, 척도 설명 등) */
  notes: readonly string[];
  /** 비교 지역 최대 개수를 넘겨 선택하려 할 때의 경고. 없으면 null. */
  limitWarning: string | null;
}

export function RegionMapCard({
  title,
  description,
  notes,
  limitWarning,
  ...mapProps
}: RegionMapCardProps) {
  return (
    <Card
      title={title}
      description={description}
      meta={
        <span data-map-meta="">
          {mapProps.metricLabel} · {mapProps.year}
        </span>
      }
    >
      <ChoroplethMap {...mapProps} />
      <div className="mt-4 space-y-3">
        <MapLegend
          scale={mapProps.scale}
          metricLabel={mapProps.metricLabel}
          formatValue={mapProps.formatValue}
          missingLabel={mapProps.missingLabel}
        />
        {notes.map((note) => (
          <p className="text-small text-[var(--km-color-text-muted)]" key={note}>
            {note}
          </p>
        ))}
        {limitWarning !== null ? (
          <p className="text-small text-destructive" role="alert">
            {limitWarning}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
