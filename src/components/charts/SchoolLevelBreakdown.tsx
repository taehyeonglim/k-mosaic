import {
  Bar,
  BarChart,
  Cell,
  LabelList,
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

export interface SchoolLevelBreakdownItem {
  level: string;
  label: string;
  count: number | null;
  rate: number | null;
}

export interface SchoolLevelBreakdownProps {
  items: SchoolLevelBreakdownItem[];
  formatCount(v: number | null): string;
  formatRate(v: number | null): string;
}

function BreakdownBars({
  items,
  dataKey,
  formatValue,
}: {
  items: SchoolLevelBreakdownItem[];
  dataKey: 'count' | 'rate';
  formatValue(v: number | null): string;
}) {
  const label = dataKey === 'count' ? ko.overview.studentCount : ko.overview.rate;

  return (
    <section className="space-y-2" aria-label={label}>
      <div className="h-[220px] w-full min-w-0" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%" minHeight={180}>
          <BarChart
            data={items}
            layout="vertical"
            margin={{ top: 8, right: 56, bottom: 8, left: 8 }}
            barCategoryGap={12}
          >
            <XAxis
              type="number"
              domain={[0, 'auto']}
              tickFormatter={(value) => formatValue(value as number)}
              tick={{ fill: 'var(--km-color-text-muted)' }}
              tickLine={{ stroke: 'var(--km-color-border)' }}
              axisLine={{ stroke: 'var(--km-color-border)' }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tick={{ fill: 'var(--km-color-text)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--km-color-border)' }}
            />
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
              dataKey={dataKey}
              fill="var(--km-map-count-6)"
              radius={[0, 4, 4, 0]}
              isAnimationActive="auto"
              animationDuration={150}
            >
              {items.map((item) => (
                <Cell
                  key={item.level}
                  fill={
                    item[dataKey] === null ? 'var(--km-color-missing)' : 'var(--km-map-count-6)'
                  }
                />
              ))}
              <LabelList
                dataKey={dataKey}
                position="right"
                formatter={(value) => formatValue(value as number | null)}
                fill="var(--km-color-text)"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function SchoolLevelBreakdown({
  items,
  formatCount,
  formatRate,
}: SchoolLevelBreakdownProps) {
  const tableColumns: ChartDataTableColumn[] = [
    { key: 'level', label: ko.filters.schoolLevel },
    { key: 'count', label: ko.overview.studentCount, numeric: true },
    { key: 'rate', label: ko.overview.rate, numeric: true },
  ];
  const tableRows: ChartDataTableRow[] = items.map((item) => ({
    id: item.level,
    level: item.label,
    count: formatCount(item.count),
    rate: formatRate(item.rate),
  }));
  const chartLabel =
    items.map((item) => item.label).join(', ') || ko.regionDetail.schoolLevelComposition;

  return (
    <section className="space-y-4" aria-label={chartLabel}>
      <BreakdownBars items={items} dataKey="count" formatValue={formatCount} />
      <BreakdownBars items={items} dataKey="rate" formatValue={formatRate} />
      <ChartDataTable caption={chartLabel} columns={tableColumns} rows={tableRows} visuallyHidden />
    </section>
  );
}
