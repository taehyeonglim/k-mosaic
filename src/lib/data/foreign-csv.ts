import type { ForeignNationwideStat, ForeignStudentStat } from '../schema/foreign-student';
import type { ForeignRankingRow } from './foreign';

// 외국인 유학생 CSV 직렬화 — 순수 함수, 스냅숏을 import 하지 않는다.
// 예전에는 스냅숏 JSON 을 최상위에서 import 하는 foreign.ts 에 있어서, 다운로드 버튼을 쓰는
// 클라이언트 번들에 외국인 스냅숏 전체가 따라 들어갔다 (payload 와 중복).

export interface ForeignCsvMeta {
  source: string;
  year?: number;
  referenceYear?: number;
  formula?: string;
  calculation?: string;
}

export type ForeignCsvRow = ForeignStudentStat | ForeignNationwideStat | ForeignRankingRow;

function isNationwideRow(row: ForeignCsvRow): row is ForeignNationwideStat {
  return 'scope' in row;
}

function isRankingRow(row: ForeignCsvRow): row is ForeignRankingRow {
  return 'rank' in row;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toForeignCsv(rows: ForeignCsvRow[], meta: ForeignCsvMeta): string {
  const referenceYear = meta.referenceYear ?? meta.year;
  const formula =
    meta.formula ??
    meta.calculation ??
    '외국인 학생수(학위과정) ÷ 재적 학생수 × 100 (소수 4자리 저장)';
  const comments = [
    `# 출처: ${meta.source}`,
    `# 기준연도: ${referenceYear === undefined ? '미지정' : referenceYear}`,
    `# 계산식: ${formula}`,
  ];
  const ranking = rows.length > 0 && rows.every(isRankingRow);
  if (ranking) {
    const headers = ['rank', 'regionCode', 'regionNameKo', 'value', 'isTied'];
    const lines = rows.map((row) => {
      const record = row as ForeignRankingRow;
      return [record.rank, record.regionCode, record.regionNameKo, record.value, record.isTied]
        .map(csvCell)
        .join(',');
    });
    return `\uFEFF${[...comments, headers.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
  }
  const nonRankingRows = rows.filter(
    (row): row is ForeignStudentStat | ForeignNationwideStat => !isRankingRow(row),
  );
  if (nonRankingRows.length !== rows.length)
    throw new Error('순위 행과 원자료 행을 한 CSV에 섞을 수 없습니다.');
  const regional =
    nonRankingRows.length > 0 && nonRankingRows.every((row) => !isNationwideRow(row));
  const nationwide = rows.length > 0 && rows.every(isNationwideRow);
  if (regional) {
    const headers = [
      'year',
      'regionCode',
      'regionNameKo',
      'regionNameEn',
      'foreignStudentCount',
      'enrolledStudentCount',
      'foreignStudentRateComputed',
      'notes',
    ];
    const lines = nonRankingRows.map((row) => {
      const record = row as ForeignStudentStat;
      return [
        record.year,
        record.regionCode,
        record.regionNameKo,
        record.regionNameEn,
        record.foreignStudentCount,
        record.enrolledStudentCount,
        record.foreignStudentRateComputed,
        record.notes.join(' | '),
      ]
        .map(csvCell)
        .join(',');
    });
    return `\uFEFF${[...comments, headers.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
  }
  if (nationwide) {
    const headers = ['year', 'scope', 'degreeAndTraining', 'degreeOnly'];
    const lines = nonRankingRows.map((row) => {
      const record = row as ForeignNationwideStat;
      return [record.year, record.scope, record.degreeAndTraining, record.degreeOnly]
        .map(csvCell)
        .join(',');
    });
    return `\uFEFF${[...comments, headers.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
  }

  const headers = [
    'dataset',
    'year',
    'regionCode',
    'regionNameKo',
    'regionNameEn',
    'scope',
    'foreignStudentCount',
    'enrolledStudentCount',
    'foreignStudentRateComputed',
    'degreeAndTraining',
    'degreeOnly',
    'notes',
  ];
  const lines = nonRankingRows.map((row) => {
    if (isNationwideRow(row)) {
      return [
        'nationwide',
        row.year,
        null,
        null,
        null,
        row.scope,
        null,
        null,
        null,
        row.degreeAndTraining,
        row.degreeOnly,
        null,
      ]
        .map(csvCell)
        .join(',');
    }
    return [
      'regional',
      row.year,
      row.regionCode,
      row.regionNameKo,
      row.regionNameEn,
      null,
      row.foreignStudentCount,
      row.enrolledStudentCount,
      row.foreignStudentRateComputed,
      null,
      null,
      row.notes.join(' | '),
    ]
      .map(csvCell)
      .join(',');
  });
  return `\uFEFF${[...comments, headers.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
}
