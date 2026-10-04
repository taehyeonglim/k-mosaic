import rawForeignSnapshot from '../../../data/snapshots/foreign-students.v1.json';
import { rankWithTies } from './compare';
import { REGION_BY_CODE, REGION_ORDER } from '../constants/regions';
import {
  parseForeignSnapshot,
  type ForeignNationwideStat,
  type ForeignSnapshot,
  type ForeignStudentStat,
} from '../schema/foreign-student';
import type { RegionCode } from '../schema/dimensions';

export interface ForeignRankingRow {
  rank: number;
  regionCode: RegionCode;
  regionNameKo: string;
  value: number;
  isTied: boolean;
}

export interface ForeignTrendPoint {
  year: number;
  foreignStudentCount: number | null;
  enrolledStudentCount: number | null;
  foreignStudentRateComputed: number | null;
}

export interface ForeignTrendSeries {
  regionCode: RegionCode;
  regionNameKo: string;
  points: ForeignTrendPoint[];
}

export interface ForeignCsvMeta {
  source: string;
  year?: number;
  referenceYear?: number;
  formula?: string;
  calculation?: string;
}

export type ForeignCsvRow = ForeignStudentStat | ForeignNationwideStat | ForeignRankingRow;

const FOREIGN_SNAPSHOT: ForeignSnapshot = parseForeignSnapshot(rawForeignSnapshot);

function cloneForeignRecord(record: ForeignStudentStat): ForeignStudentStat {
  return { ...record, notes: [...record.notes] };
}

function cloneNationwideRecord(record: ForeignNationwideStat): ForeignNationwideStat {
  return { ...record };
}

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

export function loadForeignSnapshot(): ForeignSnapshot {
  return FOREIGN_SNAPSHOT;
}

export function selectForeignNational(year: number): ForeignStudentStat | null {
  const record = FOREIGN_SNAPSHOT.records.find(
    (candidate) => candidate.year === year && candidate.regionCode === 'KR',
  );
  return record === undefined ? null : cloneForeignRecord(record);
}

export function selectForeignByRegion(year: number): ForeignStudentStat[] {
  return REGION_ORDER.flatMap((regionCode) => {
    const record = FOREIGN_SNAPSHOT.records.find(
      (candidate) => candidate.year === year && candidate.regionCode === regionCode,
    );
    return record === undefined ? [] : [cloneForeignRecord(record)];
  });
}

export function selectForeignRanking(year: number, metric: 'count' | 'rate'): ForeignRankingRow[] {
  const candidates = selectForeignByRegion(year).flatMap((record) => {
    const value =
      metric === 'count' ? record.foreignStudentCount : record.foreignStudentRateComputed;
    if (record.regionCode === 'KR' || value === null) return [];
    return [{ regionCode: record.regionCode, value }];
  });
  return rankWithTies(candidates).map((entry) => ({
    ...entry,
    regionNameKo: REGION_BY_CODE[entry.regionCode]!.officialKo,
  }));
}

export function selectForeignTrend(regionCodes: RegionCode[]): ForeignTrendSeries[] {
  const years = selectForeignAvailableYears();
  return regionCodes.map((regionCode) => ({
    regionCode,
    regionNameKo: REGION_BY_CODE[regionCode]!.officialKo,
    points: years.map((year) => {
      const record = FOREIGN_SNAPSHOT.records.find(
        (candidate) => candidate.year === year && candidate.regionCode === regionCode,
      );
      return {
        year,
        foreignStudentCount: record?.foreignStudentCount ?? null,
        enrolledStudentCount: record?.enrolledStudentCount ?? null,
        foreignStudentRateComputed: record?.foreignStudentRateComputed ?? null,
      };
    }),
  }));
}

export function selectForeignNationwideTrend(): ForeignNationwideStat[] {
  return [...FOREIGN_SNAPSHOT.nationwide]
    .sort((left, right) => left.year - right.year)
    .map(cloneNationwideRecord);
}

export function selectForeignAvailableYears(): number[] {
  return [...FOREIGN_SNAPSHOT.coverage.years].sort((left, right) => left - right);
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
