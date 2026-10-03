import { describe, expect, it } from 'vitest';

import { parseForeignEnaraTable } from '../../scripts/fetch-foreign-students';

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

const ROWS: Array<[string | null, string]> = [
  ['국외한국인유학생', '초등학교'],
  [null, '중학교'],
  [null, '고등학교'],
  [null, '대학(학위+연수)'],
  [null, '대학(학위)'],
  ['국내외국인유학생', '대학(학위+연수)'],
  [null, '대학(학위)'],
  // 숫자 HTML 엔티티(&#183; = ·)가 라벨에 있어도 해석되어야 한다.
  ['유학&#183;연수수지', '국내수입액'],
  [null, '해외지급액'],
  [null, '유학&#183;연수수지'],
];

function fixture(): string {
  const header = `<tr><th>구분</th>${YEARS.map((year) => `<th>${year}</th>`).join('')}</tr>`;
  const body = ROWS.map(([group, detail], rowIndex) => {
    const headers = group === null ? `<th>${detail}</th>` : `<th>${group}</th><th>${detail}</th>`;
    const cells = YEARS.map(
      (year, yearIndex) => `<td item-id="${year}Y">${(rowIndex + 1) * 1000 + yearIndex}</td>`,
    ).join('');
    return `<tr>${headers}${cells}</tr>`;
  }).join('');
  return `<table id="t_Table_153401">${header}${body}</table>`;
}

describe('e-나라지표 153401 파서', () => {
  it('숫자 HTML 엔티티가 포함된 라벨을 해석한다', () => {
    const table = parseForeignEnaraTable(fixture());

    expect(table.years).toEqual(YEARS);
    expect(table.rows[0]).toEqual({
      year: 2018,
      scope: 'nationwide',
      degreeAndTraining: 6000,
      degreeOnly: 7000,
    });
  });
});
