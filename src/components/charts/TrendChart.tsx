import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ActiveDotProps, DotItemDotProps } from 'recharts';
import type { ReactNode } from 'react';

import { ko } from '@/content/ko';

import {
  ChartDataTable,
  type ChartDataTableColumn,
  type ChartDataTableRow,
} from './ChartDataTable';

export interface TrendChartProps {
  series: {
    regionCode: string;
    label: string;
    points: { year: number; value: number | null }[];
  }[];
  metric: 'count' | 'rate';
  formatValue(v: number | null): string;
  annotations?: { year: number; label: string }[];
}

type MarkerShape = 'circle' | 'diamond' | 'triangle';

interface TrendDatum {
  year: number;
  [regionCode: string]: number | null;
}

interface MarkerPositionProps {
  cx?: number;
  cy?: number;
  r?: number | string;
  value?: number | null;
}

const SERIES_COLORS = [
  'var(--km-map-count-7)',
  'var(--km-map-count-5)',
  'var(--km-map-count-3)',
] as const;

function markerShape(index: number): MarkerShape {
  return index === 1 ? 'diamond' : index === 2 ? 'triangle' : 'circle';
}

function markerElement(shape: MarkerShape, color: string, props: MarkerPositionProps): ReactNode {
  if (props.cx === undefined || props.cy === undefined || props.value === null) {
    return null;
  }
  const cx = props.cx ?? 0;
  const cy = props.cy ?? 0;
  const radius = Number(props.r ?? 4);
  const size = Math.max(3, radius);

  if (shape === 'diamond') {
    return (
      <rect
        x={cx - size}
        y={cy - size}
        width={size * 2}
        height={size * 2}
        transform={`rotate(45 ${cx} ${cy})`}
        fill="var(--km-color-surface)"
        stroke={color}
        strokeWidth={2}
      />
    );
  }
  if (shape === 'triangle') {
    return (
      <path
        d={`M ${cx} ${cy - size - 1} L ${cx + size + 1} ${cy + size} L ${cx - size - 1} ${cy + size} Z`}
        fill="var(--km-color-surface)"
        stroke={color}
        strokeWidth={2}
      />
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={size}
      fill="var(--km-color-surface)"
      stroke={color}
      strokeWidth={2}
    />
  );
}

function renderMarker(shape: MarkerShape, color: string) {
  return (props: DotItemDotProps): ReactNode => markerElement(shape, color, props);
}

function renderActiveMarker(shape: MarkerShape, color: string) {
  return (props: ActiveDotProps): ReactNode => markerElement(shape, color, props);
}

function LegendMarker({ shape, color }: { shape: MarkerShape; color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {markerElement(shape, color, { cx: 8, cy: 8, r: 4 })}
    </svg>
  );
}

export function TrendChart({ series, metric, formatValue, annotations = [] }: TrendChartProps) {
  const displayedSeries = series.slice(0, 3);
  const yearSet = new Set<number>();
  displayedSeries.forEach((item) => {
    item.points.forEach((point) => yearSet.add(point.year));
  });
  const years = Array.from(yearSet).sort((first, second) => first - second);
  const chartData: TrendDatum[] = years.map((year) => {
    const datum: TrendDatum = { year };
    displayedSeries.forEach((item) => {
      const point = item.points.find((candidate) => candidate.year === year);
      datum[item.regionCode] = point?.value ?? null;
    });
    return datum;
  });

  const tableColumns: ChartDataTableColumn[] = [
    { key: 'year', label: ko.filters.year, numeric: true },
    ...displayedSeries.map((item) => ({ key: item.regionCode, label: item.label })),
  ];
  const tableRows: ChartDataTableRow[] = chartData.map((datum) => ({
    id: datum.year,
    year: datum.year,
    ...Object.fromEntries(
      displayedSeries.map((item) => [item.regionCode, formatValue(datum[item.regionCode] ?? null)]),
    ),
  }));
  const chartLabel =
    displayedSeries.map((item) => item.label).join(', ') || ko.filters.metrics[metric];

  return (
    <section className="space-y-3" aria-label={chartLabel}>
      <ul className="flex flex-wrap justify-end gap-x-4 gap-y-2 text-small" aria-label={chartLabel}>
        {displayedSeries.map((item, index) => {
          const color = SERIES_COLORS[index] ?? SERIES_COLORS[0];
          return (
            <li className="flex items-center gap-1.5" key={item.regionCode}>
              <LegendMarker shape={markerShape(index)} color={color} />
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>

      <div className="h-[320px] w-full min-w-0" role="img" aria-label={ko.filters.metrics[metric]}>
        <ResponsiveContainer width="100%" height="100%" minHeight={280}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 12, left: 8 }}>
            <CartesianGrid
              stroke="var(--km-color-border)"
              strokeDasharray="3 3"
              strokeOpacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="year"
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fill: 'var(--km-color-text-muted)', fontSize: 12 }}
              tickLine={{ stroke: 'var(--km-color-border)' }}
              axisLine={{ stroke: 'var(--km-color-border)' }}
            />
            <YAxis
              domain={[0, 'auto']}
              tickFormatter={(value) => formatValue(value as number)}
              tick={{ fill: 'var(--km-color-text-muted)', fontSize: 12 }}
              tickLine={{ stroke: 'var(--km-color-border)' }}
              axisLine={{ stroke: 'var(--km-color-border)' }}
              width={72}
            />
            <Tooltip
              filterNull={false}
              formatter={(value, name) => [formatValue(value as number | null), String(name)]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                backgroundColor: 'var(--km-color-surface)',
                borderColor: 'var(--km-color-border)',
                color: 'var(--km-color-text)',
              }}
              cursor={{ stroke: 'var(--km-color-focus)', strokeDasharray: '4 4' }}
            />
            {annotations.map((annotation) => (
              <ReferenceLine
                key={`${annotation.year}-${annotation.label}`}
                x={annotation.year}
                stroke="var(--km-color-text-muted)"
                strokeDasharray="4 4"
                label={annotation.label}
              />
            ))}
            {displayedSeries.map((item, index) => {
              const color = SERIES_COLORS[index] ?? SERIES_COLORS[0];
              const shape = markerShape(index);
              return (
                <Line
                  key={item.regionCode}
                  type="monotone"
                  dataKey={item.regionCode}
                  name={item.label}
                  stroke={color}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={renderMarker(shape, color)}
                  activeDot={renderActiveMarker(shape, color)}
                  isAnimationActive="auto"
                  animationDuration={150}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ChartDataTable caption={chartLabel} columns={tableColumns} rows={tableRows} visuallyHidden />
    </section>
  );
}
