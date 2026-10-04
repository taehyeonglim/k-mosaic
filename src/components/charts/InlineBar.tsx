import { ko } from '@/content/ko';
import { barGeometry, type BarDomain } from '@/lib/visualization/bar';

export interface InlineBarProps {
  value: number | null;
  /** 같은 열의 값 범위 (barDomain) — 막대 길이의 기준 */
  domain: BarDomain;
  /** 화면에 적는 값 */
  label: string;
  /** 선택한 항목 — 강조 보라 */
  selected?: boolean;
  /** 값 칸의 너비 — 같은 열의 행끼리 맞아야 막대 끝이 가지런하다. */
  valueWidth?: 'default' | 'count' | 'rate';
}

const VALUE_WIDTHS = {
  default: 'w-[4.75rem] sm:w-[5.25rem]',
  count: 'w-[4.25rem]',
  rate: 'w-[3rem]',
} as const;

/**
 * 표 칸 안의 막대 + 값. 막대는 0 기준선에서 출발하고 길이는 값에 비례한다.
 * 한 가지 색 — 크기는 길이가 전한다. 값 쪽 끝만 둥글게, 기준선 쪽은 각지게.
 */
export function InlineBar({
  value,
  domain,
  label,
  selected = false,
  valueWidth = 'default',
}: InlineBarProps) {
  const bar = value === null ? null : barGeometry(value, domain);
  const baseline = barGeometry(0, domain).offset;

  return (
    <span className="flex items-center gap-2 sm:gap-3">
      <span aria-hidden="true" className="relative h-2.5 min-w-0 flex-1">
        {domain.min < 0 ? (
          <span
            className="absolute inset-y-[-0.1875rem] w-px bg-border-strong"
            style={{ left: `${baseline}%` }}
          />
        ) : null}
        {bar !== null ? (
          <span
            className={`absolute inset-y-0 ${selected ? 'bg-accent2' : 'bg-ramp-5'} ${
              bar.direction === 'negative' ? 'rounded-l-[4px]' : 'rounded-r-[4px]'
            }`}
            data-direction={bar.direction}
            data-inline-bar=""
            style={{ left: `${bar.offset}%`, width: `${bar.length}%` }}
          />
        ) : null}
      </span>
      {/* 결측은 0 길이 막대가 아니라 '막대 없음 + —' 로 적는다. */}
      <span
        aria-label={value === null ? ko.missing.ariaLabel : undefined}
        className={`${VALUE_WIDTHS[valueWidth]} shrink-0 text-end tabular-nums ${value === null ? 'text-text-muted' : ''}`}
        data-inline-value=""
        data-missing={value === null || undefined}
      >
        {label}
      </span>
    </span>
  );
}
