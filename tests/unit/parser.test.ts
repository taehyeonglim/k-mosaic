import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchEnaraTable } from '../../scripts/lib/enara';

const fixture = readFileSync(new URL('../fixtures/enara-F008403.html', import.meta.url), 'utf8');

function mockEnaraResponse(html: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('e-나라지표 HTML 파서', () => {
  it('실제 응답 형태의 표를 파싱한다', async () => {
    mockEnaraResponse(fixture);

    const table = await fetchEnaraTable('F008403');
    expect(table.years).toEqual([2024, 2025]);
    expect(table.regionsShort).toEqual(['전국', '서울', '세종']);
    expect(table.rows).toHaveLength(60);
    expect(table.rows[0]).toMatchObject({
      year: 2024,
      regionCode: 'KR',
      schoolLevel: 'all',
      metric: 'count',
      value: 1234,
    });
  });

  it("'-' 셀은 0이 아니라 null로 파싱한다", async () => {
    mockEnaraResponse(fixture);

    const table = await fetchEnaraTable('F008403');
    expect(
      table.rows.find(
        (row) =>
          row.year === 2024 &&
          row.regionCode === '36' &&
          row.schoolLevel === 'other' &&
          row.metric === 'count',
      )?.value,
    ).toBeNull();
    expect(
      table.rows.find(
        (row) =>
          row.year === 2024 &&
          row.regionCode === '36' &&
          row.schoolLevel === 'other' &&
          row.metric === 'count',
      )?.value,
    ).not.toBe(0);
  });

  it("천단위 구분자 '1,234'를 숫자 1234로 파싱한다", async () => {
    mockEnaraResponse(fixture);

    const table = await fetchEnaraTable('F008403');
    expect(table.rows[0]?.value).toBe(1234);
  });

  it.each([
    ['열이 추가됨', fixture.replace('<td>100</td>', '<td>100</td><td>999</td>')],
    ['첫 지역이 전국이 아님', fixture.replace(/(<tr>\s*)<th>전국<\/th>/, '$1<th>서울</th>')],
    ['셀 수 불일치', fixture.replace(/<td>1,234<\/td>\s*<td>100<\/td>/, '<td>1,234</td>')],
  ])('표 구조가 변경되면 예외를 발생시킨다: %s', async (_name, html) => {
    mockEnaraResponse(html);

    await expect(fetchEnaraTable('F008403')).rejects.toThrow();
  });
});
