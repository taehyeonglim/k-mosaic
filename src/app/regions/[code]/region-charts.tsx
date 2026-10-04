'use client';

import {
  SchoolLevelBreakdown,
  type SchoolLevelBreakdownItem,
} from '@/components/charts/SchoolLevelBreakdown';
import { TrendChart, type TrendChartProps } from '@/components/charts/TrendChart';
import { ko } from '@/content/ko';
import { formatCount, formatRate } from '@/lib/visualization/format';

// 지역 페이지의 차트 — Recharts 는 클라이언트에서만 그려지고, 포맷 함수는 서버에서 넘길 수
// 없으므로 데이터만 받아 여기서 포맷을 붙인다.

const countFormat = (value: number | null) => formatCount(value, ko.missing.value);
const rateFormat = (value: number | null) => formatRate(value, ko.missing.value);

export function RegionTrendCharts({
  countSeries,
  rateSeries,
}: {
  countSeries: TrendChartProps['series'];
  rateSeries: TrendChartProps['series'];
}) {
  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-2">
      <section className="min-w-0 space-y-3" aria-labelledby="region-count-trend-title">
        <h3 id="region-count-trend-title" className="text-base font-medium">
          {ko.regionPage.countTrend}
        </h3>
        <TrendChart series={countSeries} metric="count" formatValue={countFormat} />
      </section>
      <section className="min-w-0 space-y-3" aria-labelledby="region-rate-trend-title">
        <h3 id="region-rate-trend-title" className="text-base font-medium">
          {ko.regionPage.rateTrend}
        </h3>
        <TrendChart series={rateSeries} metric="rate" formatValue={rateFormat} />
      </section>
    </div>
  );
}

export function RegionLevelBreakdown({ items }: { items: SchoolLevelBreakdownItem[] }) {
  return <SchoolLevelBreakdown items={items} formatCount={countFormat} formatRate={rateFormat} />;
}
