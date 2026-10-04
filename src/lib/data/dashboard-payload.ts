import type { ExtendedFeatureCollection as FeatureCollection } from 'd3-geo';

import type { RegionCode, SchoolLevel } from '../schema/index';
import type { CompactDataset, CompactRecord } from './compact';

/** 서버가 만들어 대시보드(클라이언트)로 넘기는 데이터. 스냅숏 전체가 아니라 화면에 필요한 만큼만 싣는다. */
export interface DashboardPayload {
  geo: FeatureCollection;
  years: number[];
  levels: SchoolLevel[];
  regionCodes: RegionCode[];
  regionLabels: Record<string, string>;
  records: CompactRecord[];
  noteSets: string[][];
  sources: {
    role: string;
    provider: string;
    organization: string;
    statisticsName: string;
    tableId: string;
    tableName: string;
    sourceUrl: string;
    retrievedAt: string;
    referenceDate: string | null;
    isProvisional: boolean | null;
  }[];
  retrievedAtLabel: string;
  rateFormula: string;
  /** 공표 비율 정수 반올림 안내. 해당 연도가 없으면 null. */
  ratePrecisionNote: string | null;
  /** 전국 학교급별 장기 시계열(2016~) — 전국 추세 차트와 히어로의 장기 증감이 쓴다. */
  nationwide: CompactDataset;
}
