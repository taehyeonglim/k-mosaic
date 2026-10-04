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

const FOREIGN_SNAPSHOT: ForeignSnapshot = parseForeignSnapshot(rawForeignSnapshot);

function cloneForeignRecord(record: ForeignStudentStat): ForeignStudentStat {
  return { ...record, notes: [...record.notes] };
}

function cloneNationwideRecord(record: ForeignNationwideStat): ForeignNationwideStat {
  return { ...record };
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

// CSV 직렬화는 foreign-csv.ts 로 옮겼다 — 클라이언트가 이 모듈(스냅숏 JSON 포함)을 import 하지 않게.
export { toForeignCsv, type ForeignCsvMeta, type ForeignCsvRow } from './foreign-csv';
