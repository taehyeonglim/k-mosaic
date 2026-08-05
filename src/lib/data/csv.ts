import type { RankingRow, StatView } from './types';
import type { Snapshot } from '../schema/index';

export interface CsvMeta {
  source: string;
  year?: number;
  referenceYear?: number;
  baseYear?: number;
  formula?: string;
  calculation?: string;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: StatView[] | RankingRow[], meta: CsvMeta): string {
  const isRanking = rows.length > 0 && rows[0] !== undefined && 'rank' in rows[0];
  const headers = isRanking
    ? ['rank', 'regionCode', 'regionNameKo', 'value', 'isTied']
    : ['regionCode', 'regionNameKo', 'count', 'totalStudents', 'rate', 'isMissing'];
  const referenceYear = meta.referenceYear ?? meta.baseYear ?? meta.year;
  const formula = meta.formula ?? meta.calculation ?? '다문화학생 수 ÷ 전체 학생 수 × 100';
  const comments = [
    `# 출처: ${meta.source}`,
    `# 기준연도: ${referenceYear === undefined ? '미지정' : referenceYear}`,
    `# 계산식: ${formula}`,
  ];
  const data = rows.map((row) => {
    if (isRanking) {
      const ranking = row as RankingRow;
      return [
        ranking.rank,
        ranking.regionCode,
        ranking.regionNameKo,
        ranking.value,
        ranking.isTied,
      ];
    }
    const stat = row as StatView;
    return [
      stat.regionCode,
      stat.regionNameKo,
      stat.count,
      stat.totalStudents,
      stat.rate,
      stat.isMissing,
    ];
  });
  return `\uFEFF${[...comments, headers.map(csvCell).join(','), ...data.map((row) => row.map(csvCell).join(','))].join('\r\n')}\r\n`;
}

export function snapshotToCsv(snapshot: Snapshot): string {
  const headers = [
    'year',
    'regionCode',
    'regionNameKo',
    'regionNameEn',
    'schoolLevel',
    'studentType',
    'multiculturalStudentCount',
    'totalStudentCount',
    'multiculturalStudentRateComputed',
    'multiculturalStudentRatePublished',
    'notes',
  ];
  const comments = [
    '# 출처: e-나라지표 F008403 + KOSIS DT_1963003_002·003·004·009',
    `# 기준연도: ${snapshot.coverage.years.join(', ')}`,
    `# 계산식: ${snapshot.rateFormula}`,
  ];
  const rows = snapshot.records.map((record) =>
    [
      record.year,
      record.regionCode,
      record.regionNameKo,
      record.regionNameEn,
      record.schoolLevel,
      record.studentType,
      record.multiculturalStudentCount,
      record.totalStudentCount,
      record.multiculturalStudentRateComputed,
      record.multiculturalStudentRatePublished,
      record.notes.join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  return `\uFEFF${[...comments, headers.map(csvCell).join(','), ...rows].join('\r\n')}\r\n`;
}
