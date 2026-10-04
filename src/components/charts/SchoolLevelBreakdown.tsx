import { ko } from '@/content/ko';
import { barDomain } from '@/lib/visualization/bar';

import { InlineBar } from './InlineBar';

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

/**
 * 학교급별 학생 수와 비율 — 표 한 장에 막대를 곁들인다.
 * 항목이 넷뿐이라 축·격자가 있는 차트 두 장보다 값이 바로 읽히는 표가 낫다.
 */
export function SchoolLevelBreakdown({
  items,
  formatCount,
  formatRate,
}: SchoolLevelBreakdownProps) {
  const countDomain = barDomain(items.map((item) => item.count));
  const rateDomain = barDomain(items.map((item) => item.rate));

  // 고정 배치 — 좁은 화면에서는 막대가 줄어들 뿐 표가 가로로 넘치지 않는다.
  return (
    <table className="table table-fixed">
      <caption className="sr-only">{ko.regionDetail.schoolLevelComposition}</caption>
      <colgroup>
        <col className="w-[5.5rem]" />
        <col className="w-[55%]" />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">{ko.filters.schoolLevel}</th>
          <th scope="col" className="text-end">
            {ko.overview.studentCount}
          </th>
          <th scope="col" className="text-end">
            {ko.overview.rate}
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.level}>
            <th scope="row">{item.label}</th>
            <td>
              <InlineBar
                value={item.count}
                domain={countDomain}
                label={formatCount(item.count)}
                valueWidth="count"
              />
            </td>
            <td>
              <InlineBar
                value={item.rate}
                domain={rateDomain}
                label={formatRate(item.rate)}
                valueWidth="rate"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
