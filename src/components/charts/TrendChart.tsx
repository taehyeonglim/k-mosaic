import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
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
  resolveSeriesStyles,
  type MarkerShape,
  type SeriesSlot,
} from '@/lib/visualization/series-style';

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
    /** 범주색 자리 고정 — 비교 지역을 더하거나 빼도 색이 바뀌지 않게 한다. */
    slot?: SeriesSlot;
    /** 기준 계열(전국 값) — 중립색 점선 */
    reference?: boolean;
  }[];
  metric: 'count' | 'rate';
  formatValue(v: number | null): string;
  annotations?: { year: number; label: string }[];
}

interface TrendDatum {
  year: number;
  [regionCode: string]: number | null;
}

interface MarkerPositionProps {
  cx?: number;
  cy?: number;
  value?: number | null;
}

const MARKER_RADIUS = 4;
const TICK = { fill: 'var(--km-color-text-muted)', fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--km-color-surface)',
  border: '1px solid var(--km-color-border)',
  borderRadius: 'var(--km-radius-md)',
  boxShadow: 'var(--km-shadow-floating)',
  color: 'var(--km-color-text)',
  fontSize: '0.8125rem',
  padding: '0.5rem 0.75rem',
};

/** 마커 — 계열색으로 채우고 표면색 2px 테두리를 둘러 선·다른 마커와 겹쳐도 구분된다. */
function markerElement(shape: MarkerShape, color: string, props: MarkerPositionProps): ReactNode {
  if (props.cx === undefined || props.cy === undefined || props.value == null) {
    return null;
  }
  const { cx, cy } = props;
  const size = MARKER_RADIUS;
  const paint = { fill: color, stroke: 'var(--km-color-surface)', strokeWidth: 2 };

  if (shape === 'diamond') {
    return (
      <rect
        {...paint}
        x={cx - size}
        y={cy - size}
        width={size * 2}
        height={size * 2}
        transform={`rotate(45 ${cx} ${cy})`}
      />
    );
  }
  if (shape === 'square') {
    return <rect {...paint} x={cx - size} y={cy - size} width={size * 2} height={size * 2} />;
  }
  if (shape === 'triangle') {
    return (
      <path
        {...paint}
        d={`M ${cx} ${cy - size - 1.5} L ${cx + size + 1.5} ${cy + size} L ${cx - size - 1.5} ${cy + size} Z`}
      />
    );
  }
  return <circle {...paint} cx={cx} cy={cy} r={size + 0.5} />;
}

function LegendMarker({ shape, color }: { shape: MarkerShape; color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {markerElement(shape, color, { cx: 8, cy: 8, value: 0 })}
    </svg>
  );
}

export function TrendChart({ series, metric, formatValue, annotations = [] }: TrendChartProps) {
  const displayedSeries = series.slice(0, 3);
  const styles = resolveSeriesStyles(displayedSeries);
  const solo = styles[0]?.solo === true;
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
  // 단독 계열의 끝점(값이 있는 마지막 연도)에만 값을 적는다 — 모든 점에 숫자를 달지 않는다.
  const soloCode = solo ? displayedSeries[0]?.regionCode : undefined;
  const endIndex =
    soloCode === undefined
      ? -1
      : chartData.reduce((last, datum, index) => (datum[soloCode] != null ? index : last), -1);

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
      {/* 계열이 하나면 범례를 두지 않는다 — 제목이 이미 무엇인지 말한다.
          글자는 본문색, 정체성은 옆의 마커가 전한다. */}
      {displayedSeries.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-small" aria-label={chartLabel}>
          {displayedSeries.map((item, index) => {
            const style = styles[index]!;
            return (
              <li className="flex items-center gap-1.5" key={item.regionCode}>
                <LegendMarker shape={style.shape} color={style.color} />
                <span>{item.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="h-[300px] w-full min-w-0" role="img" aria-label={ko.filters.metrics[metric]}>
        <ResponsiveContainer width="100%" height="100%" minHeight={260}>
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: solo ? 84 : 16, bottom: 8, left: 4 }}
          >
            <CartesianGrid stroke="var(--km-color-border)" vertical={false} />
            <XAxis
              dataKey="year"
              type="number"
              domain={['dataMin', 'dataMax']}
              // 연 단위 자료 — 눈금은 수록 연도에만 둔다 (자리가 모자라면 일부를 건너뛴다).
              ticks={years}
              interval="equidistantPreserveStart"
              minTickGap={12}
              allowDecimals={false}
              tick={TICK}
              tickLine={false}
              tickMargin={8}
              axisLine={{ stroke: 'var(--km-color-border-strong)' }}
            />
            <YAxis
              domain={[0, 'auto']}
              tickFormatter={(value) => formatValue(value as number)}
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={68}
            />
            <Tooltip
              filterNull={false}
              formatter={(value, name) => [formatValue(value as number | null), String(name)]}
              labelFormatter={(label) => String(label)}
              contentStyle={TOOLTIP_STYLE}
              cursor={{ stroke: 'var(--km-color-border-strong)' }}
            />
            {annotations.map((annotation) => (
              <ReferenceLine
                key={`${annotation.year}-${annotation.label}`}
                x={annotation.year}
                stroke="var(--km-color-text-muted)"
                strokeDasharray="4 4"
                // 선 오른쪽 위에 작게 적는다 — 가운데에 두면 첫 연도에서 y축 눈금과 겹친다.
                label={{
                  value: annotation.label,
                  position: 'insideTopLeft',
                  offset: 6,
                  fill: 'var(--km-color-text-muted)',
                  fontSize: 11,
                }}
              />
            ))}
            {solo && soloCode !== undefined ? (
              <Area
                type="monotone"
                dataKey={soloCode}
                stroke="none"
                fill={styles[0]!.color}
                fillOpacity={0.1}
                connectNulls={false}
                activeDot={false}
                tooltipType="none"
                isAnimationActive="auto"
                animationDuration={150}
              />
            ) : null}
            {displayedSeries.map((item, index) => {
              const style = styles[index]!;
              return (
                <Line
                  key={item.regionCode}
                  type="monotone"
                  dataKey={item.regionCode}
                  name={item.label}
                  stroke={style.color}
                  strokeWidth={2}
                  strokeDasharray={style.dashed ? '6 4' : undefined}
                  connectNulls={false}
                  dot={(props: DotItemDotProps) => markerElement(style.shape, style.color, props)}
                  activeDot={(props: ActiveDotProps) =>
                    markerElement(style.shape, style.color, props)
                  }
                  isAnimationActive="auto"
                  animationDuration={150}
                >
                  {style.solo ? (
                    <LabelList
                      dataKey={item.regionCode}
                      content={({ x, y, index: pointIndex, value }) =>
                        pointIndex === endIndex &&
                        typeof x === 'number' &&
                        typeof y === 'number' ? (
                          <g>
                            <text
                              data-end-label=""
                              x={x + 10}
                              y={y + 1}
                              fill="var(--km-color-text)"
                              fontSize={13}
                              fontWeight={700}
                            >
                              {formatValue(typeof value === 'number' ? value : null)}
                            </text>
                            <text
                              x={x + 10}
                              y={y + 16}
                              fill="var(--km-color-text-muted)"
                              fontSize={11}
                            >
                              {chartData[endIndex]?.year}
                            </text>
                          </g>
                        ) : null
                      }
                    />
                  ) : null}
                </Line>
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ChartDataTable caption={chartLabel} columns={tableColumns} rows={tableRows} visuallyHidden />
    </section>
  );
}
