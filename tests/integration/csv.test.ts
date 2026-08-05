import { describe, expect, it } from 'vitest';

import { toCsv } from '@/lib/data/csv';
import { selectByRegion } from '@/lib/data/selectors';

describe('CSV export 통합', () => {
  it('toCsv 출력은 UTF-8 BOM으로 시작한다', () => {
    const csv = toCsv(selectByRegion(2025, 'all'), {
      source: 'e-나라지표 F008403 + KOSIS',
      referenceYear: 2025,
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('선두 주석 행에 출처·기준연도·계산식이 포함된다', () => {
    const csv = toCsv(selectByRegion(2025, 'all'), {
      source: 'e-나라지표 F008403 + KOSIS DT_1963003_002·003·004·009',
      referenceYear: 2025,
      formula: '다문화학생 수 ÷ 전체 학생 수 × 100',
    });
    const comments = csv.split('\r\n').slice(0, 3).join('\n');
    expect(comments).toContain('# 출처: e-나라지표 F008403 + KOSIS');
    expect(comments).toContain('# 기준연도: 2025');
    expect(comments).toContain('# 계산식: 다문화학생 수 ÷ 전체 학생 수 × 100');
  });

  it('결측 값은 빈 칸으로 출력되고 0으로 바뀌지 않는다', () => {
    const csv = toCsv(selectByRegion(2024, 'other'), {
      source: 'fixture',
      referenceYear: 2024,
    });
    const missingRow = csv.split('\r\n').find((line) => line.startsWith('29,'));
    expect(missingRow).toBeDefined();
    expect(missingRow).toContain(',,');
    expect(missingRow).not.toMatch(/,0(?:,|$)/);
  });
});
