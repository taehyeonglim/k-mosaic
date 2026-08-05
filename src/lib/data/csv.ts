import type { RankingRow, StatView } from './types';

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
