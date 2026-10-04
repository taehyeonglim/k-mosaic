import { describe, expect, it } from 'vitest';

import { REGION_ORDER } from '@/lib/constants/regions';
import { decodeStatRecords, encodeStatRecords } from '@/lib/data/compact';
import { rankWithTies } from '@/lib/data/compare';
import { createSelectors } from '@/lib/data/select';
import {
  selectAvailableYears,
  selectByRegion,
  selectNationwideTrend,
  selectNational,
  selectRanking,
  selectRegionDetail,
  selectTrend,
} from '@/lib/data/selectors';
import { loadSnapshot } from '@/lib/data/snapshot';
import type { SchoolLevel } from '@/lib/schema';

const LEVELS: SchoolLevel[] = ['all', 'elementary', 'middle', 'high', 'other'];
const METRICS = ['count', 'rate', 'deltaAbs', 'deltaPct'] as const;

/** 화면이 받는 것과 같은 경로: 서버 인코딩 → payload → 클라이언트 디코딩 → createSelectors */
function clientSelectors() {
  const dataset = encodeStatRecords(loadSnapshot().records, {
    years: selectAvailableYears(),
    regionScopes: ['KR', ...REGION_ORDER],
    levels: LEVELS,
  });
  return createSelectors(decodeStatRecords(JSON.parse(JSON.stringify(dataset))));
}

describe('화면(클라이언트) 셀렉터와 서버 셀렉터의 일치', () => {
  const client = clientSelectors();

  it('수록 연도가 같다', () => {
    expect(client.years).toEqual(selectAvailableYears());
  });

  for (const year of selectAvailableYears()) {
    for (const level of LEVELS) {
      it(`${year}년 ${level}: 전국·시도·순위 4종·지역 상세가 같다`, () => {
        expect(client.selectNational(year, level)).toEqual(selectNational(year, level));
        expect(client.selectByRegion(year, level)).toEqual(selectByRegion(year, level));
        for (const metric of METRICS) {
          expect(client.selectRanking(year, level, metric)).toEqual(
            selectRanking(year, level, metric),
          );
        }
        for (const code of REGION_ORDER) {
          expect(client.selectRegionDetail(code, year, level)).toEqual(
            selectRegionDetail(code, year, level),
          );
        }
      });
    }
  }

  it('전국 장기 시계열(2016~) 추세가 같다', () => {
    const snapshot = loadSnapshot();
    const nationwide = createSelectors(
      decodeStatRecords(
        JSON.parse(
          JSON.stringify(
            encodeStatRecords(snapshot.nationwide, {
              years: snapshot.coverage.nationwideYears,
              regionScopes: ['KR'],
              levels: LEVELS,
            }),
          ),
        ),
      ),
    );
    for (const level of LEVELS) {
      for (const metric of ['count', 'rate'] as const) {
        expect(nationwide.selectTrend(['KR'], level, metric)).toEqual(
          selectNationwideTrend(level, metric),
        );
      }
    }
    expect(nationwide.years[0]).toBe(2016);
  });

  it('시계열이 같다', () => {
    for (const level of LEVELS) {
      expect(client.selectTrend(['KR', ...REGION_ORDER], level, 'rate')).toEqual(
        selectTrend(['KR', ...REGION_ORDER], level, 'rate'),
      );
    }
  });
});

describe('동점 순위 계산', () => {
  it('공동 순위 뒤 순위를 건너뛰고, 같은 값은 코드순으로 놓는다', () => {
    const ranked = rankWithTies([
      { regionCode: '27', value: 5 },
      { regionCode: '11', value: 9 },
      { regionCode: '26', value: 5 },
      { regionCode: '28', value: 1 },
    ]);
    expect(ranked.map(({ regionCode, rank, isTied }) => [regionCode, rank, isTied])).toEqual([
      ['11', 1, false],
      ['26', 2, true],
      ['27', 2, true],
      ['28', 4, false],
    ]);
  });

  it('소수 4자리로 반올림한 뒤 비교한다', () => {
    const ranked = rankWithTies([
      { regionCode: '11', value: 1.00001 },
      { regionCode: '26', value: 1.00004 },
    ]);
    expect(ranked.every((entry) => entry.rank === 1 && entry.isTied)).toBe(true);
  });
});
