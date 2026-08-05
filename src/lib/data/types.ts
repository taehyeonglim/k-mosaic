import type { RegionCode, RegionScope, SchoolLevel } from '../schema/index';

export interface StatView {
  regionCode: RegionScope;
  regionNameKo: string;
  count: number | null;
  totalStudents: number | null;
  rate: number | null;
  isMissing: boolean;
}

export interface RankingRow {
  rank: number;
  regionCode: RegionCode;
  regionNameKo: string;
  value: number;
  isTied: boolean;
}

export interface TrendPoint {
  year: number;
  value: number | null;
}

export interface TrendSeries {
  regionCode: RegionScope;
  regionNameKo: string;
  points: TrendPoint[];
}

export interface LevelStatView extends StatView {
  schoolLevel: SchoolLevel;
}

export interface RegionDetail {
  regionCode: RegionCode;
  nameKo: string;
  count: number | null;
  rate: number | null;
  rank: number | null;
  diffFromNational: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  byLevel: LevelStatView[];
  trend: TrendPoint[];
  notes: string[];
}
