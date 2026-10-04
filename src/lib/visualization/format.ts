const countFormatter = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 0,
});

const rateFormatter = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const deltaFormatter = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 1,
});

export function formatCount(v: number | null, missing: string): string {
  return v === null ? missing : `${countFormatter.format(v)}명`;
}

export function formatRate(v: number | null, missing: string): string {
  return v === null ? missing : `${rateFormatter.format(v)}%`;
}

export function formatDelta(v: number | null, missing: string): string {
  if (v === null) {
    return missing;
  }
  if (v === 0) {
    return deltaFormatter.format(0);
  }
  return `${v > 0 ? '+' : '-'}${deltaFormatter.format(Math.abs(v))}`;
}

/** 지표에 맞는 표시 형식 — 학생 수는 '명', 비율은 소수 1자리 '%'. */
export function formatMetricValue(
  metric: 'count' | 'rate',
  value: number | null,
  missing: string,
): string {
  return metric === 'count' ? formatCount(value, missing) : formatRate(value, missing);
}
