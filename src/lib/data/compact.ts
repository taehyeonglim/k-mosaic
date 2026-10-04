import type { MulticulturalStudentStat, RegionScope, SchoolLevel } from '../schema/index';
import type { StatRecord } from './select';

// 대시보드 payload 의 압축 레코드 — 서버가 인코딩하고 클라이언트가 디코딩한다.
// 연도·지역·학교급은 인덱스로, 같은 주석 묶음은 한 번만 보낸다 (HTML 크기 절감).

export type CompactRecord = readonly [
  yearIndex: number,
  regionIndex: number,
  levelIndex: number,
  count: number | null,
  totalStudents: number | null,
  rate: number | null,
  notesIndex: number,
];

export interface CompactDataset {
  years: number[];
  /** 'KR' 다음에 17개 시도 순서 */
  regionScopes: RegionScope[];
  levels: SchoolLevel[];
  records: CompactRecord[];
  noteSets: string[][];
}

export function encodeStatRecords(
  stats: readonly MulticulturalStudentStat[],
  dimensions: Pick<CompactDataset, 'years' | 'regionScopes' | 'levels'>,
): CompactDataset {
  const noteSets: string[][] = [];
  const noteIndexes = new Map<string, number>();
  const records = stats.map((stat): CompactRecord => {
    const yearIndex = dimensions.years.indexOf(stat.year);
    const regionIndex = dimensions.regionScopes.indexOf(stat.regionCode);
    const levelIndex = dimensions.levels.indexOf(stat.schoolLevel);
    if (yearIndex < 0 || regionIndex < 0 || levelIndex < 0)
      throw new Error('화면용 데이터 차원 인덱스를 만들 수 없습니다.');
    const noteKey = JSON.stringify(stat.notes);
    let noteIndex = noteIndexes.get(noteKey);
    if (noteIndex === undefined) {
      noteIndex = noteSets.length;
      noteIndexes.set(noteKey, noteIndex);
      noteSets.push([...stat.notes]);
    }
    return [
      yearIndex,
      regionIndex,
      levelIndex,
      stat.multiculturalStudentCount,
      stat.totalStudentCount,
      stat.multiculturalStudentRateComputed,
      noteIndex,
    ];
  });
  return { ...dimensions, records, noteSets };
}

export function decodeStatRecords(dataset: CompactDataset): StatRecord[] {
  return dataset.records.map((record) => ({
    year: dataset.years[record[0]]!,
    regionCode: dataset.regionScopes[record[1]]!,
    schoolLevel: dataset.levels[record[2]]!,
    count: record[3],
    totalStudents: record[4],
    rate: record[5],
    notes: dataset.noteSets[record[6]] ?? [],
  }));
}

/** 스냅숏 레코드를 셀렉터 입력으로 (서버 경로). */
export function toStatRecord(stat: MulticulturalStudentStat): StatRecord {
  return {
    year: stat.year,
    regionCode: stat.regionCode,
    schoolLevel: stat.schoolLevel,
    count: stat.multiculturalStudentCount,
    totalStudents: stat.totalStudentCount,
    rate: stat.multiculturalStudentRateComputed,
    notes: stat.notes,
  };
}
