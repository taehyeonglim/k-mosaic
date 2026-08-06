import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ko } from '@/content/ko';

import {
  ChartDataTable,
  type ChartDataTableColumn,
  type ChartDataTableRow,
} from './ChartDataTable';

export interface RankingBarChartRow {
  rank: number;
  regionCode: string;
  label: string;
  value: number | null;
  isTied: boolean;
}

export interface RankingBarChartProps {
  rows: RankingBarChartRow[];
  formatValue(v: number | null): string;
  highlightRegion?: string;
}

interface RankingDatum extends RankingBarChartRow {
  displayLabel: string;
  formattedValue: string;
  plotValue: number | null;
}

export function RankingBarChart({ rows, formatValue, highlightRegion }: RankingBarChartProps) {
  const sortedRows = rows
    .slice()
    .sort(
      (first, second) =>
        first.rank - second.rank || first.regionCode.localeCompare(second.regionCode),
    );
  const chartData: RankingDatum[] = sortedRows.map((row) => ({
    ...row,
    displayLabel: `${row.rank}. ${row.label}`,
    formattedValue: formatValue(row.value),
    plotValue: row.value,
  }));
  const chartHeight = Math.max(chartData.length * 26 + 40, 160);
  const chartLabel = sortedRows.map((row) => row.label).join(', ') || ko.ranking.title;
  const tableColumns: ChartDataTableColumn[] = [
    { key: 'rank', label: ko.ranking.rank, numeric: true },
    { key: 'region', label: ko.ranking.region },
    { key: 'value', label: ko.ranking.value, numeric: true },
  ];
  const tableRows: ChartDataTableRow[] = sortedRows.map((row) => ({
    id: row.regionCode,
    rank: row.rank,
    region: row.label,
    value: formatValue(row.value),
  }));

  return (
    <section className="space-y-3" aria-label={chartLabel}>
      <div
        className="w-full min-w-0"
        style={{ height: `${chartHeight}px` }}
        role="img"
        aria-label={chartLabel}
      >
        <ResponsiveContainer width="100%" height="100%" minHeight={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 60, bottom: 12, left: 12 }}
            barCategoryGap={10}
          >
            <XAxis
              type="number"
              domain={['auto', 'auto']}
              tickFormatter={(value) => formatValue(value as number)}
              tick={{ fill: 'var(--km-color-text-muted)' }}
              tickLine={{ stroke: 'var(--km-color-border)' }}
              axisLine={{ stroke: 'var(--km-color-border)' }}
            />
            <YAxis
              type="category"
              dataKey="displayLabel"
              width={152}
              interval={0}
              tick={{ fill: 'var(--km-color-text)', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--km-color-border)' }}
            />
            <ReferenceLine x={0} stroke="var(--km-color-text-muted)" />
            <Tooltip
              filterNull={false}
              formatter={(value, name) => [formatValue(value as number | null), String(name)]}
              contentStyle={{
                backgroundColor: 'var(--km-color-surface)',
                borderColor: 'var(--km-color-border)',
                color: 'var(--km-color-text)',
              }}
            />
            <Bar
              dataKey="plotValue"
              fill="var(--km-map-count-6)"
              radius={[0, 4, 4, 0]}
              isAnimationActive="auto"
              animationDuration={150}
            >
              {chartData.map((row) => (
                <Cell
                  key={row.regionCode}
                  fill={
                    row.regionCode === highlightRegion
                      ? 'var(--km-color-accent-strong)'
                      : row.value === null
                        ? 'var(--km-color-missing)'
                        : 'var(--km-map-count-6)'
                  }
                />
              ))}
              <LabelList
                dataKey="formattedValue"
                position="right"
                fill="var(--km-color-text)"
                style={{ fontSize: 'var(--km-text-small)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartDataTable caption={chartLabel} columns={tableColumns} rows={tableRows} visuallyHidden />
    </section>
  );
}
