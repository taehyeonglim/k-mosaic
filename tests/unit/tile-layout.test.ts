import { describe, expect, it } from 'vitest';

import { REGION_BY_CODE, REGION_ORDER } from '@/lib/constants/regions';
import {
  TILE_COLUMNS,
  TILE_ORDER,
  TILE_ROWS,
  tileNameParts,
} from '@/lib/visualization/tile-layout';

// 타일 모자이크 — 17개 시·도를 4열 격자에 지리적 위치에 가깝게 놓는다.

describe('타일 배치', () => {
  it('17개 시·도가 한 번씩만 놓인다', () => {
    expect(TILE_ORDER).toHaveLength(17);
    expect(new Set(TILE_ORDER)).toEqual(new Set(REGION_ORDER));
  });

  it('행마다 열 수를 넘지 않는다', () => {
    for (const row of TILE_ROWS) expect(row.length).toBeLessThanOrEqual(TILE_COLUMNS);
  });

  it('서쪽에서 동쪽, 북쪽에서 남쪽 순서로 놓는다', () => {
    expect(TILE_ROWS.map((row) => row.map((code) => REGION_BY_CODE[code].short))).toEqual([
      ['인천', '서울', '경기', '강원'],
      ['충남', '세종', '충북', '경북'],
      ['전북', '대전', '대구', '울산'],
      ['전남', '광주', '경남', '부산'],
      ['제주'],
    ]);
  });

  it('읽는 순서(행 우선)가 곧 타일 순서다', () => {
    expect(TILE_ORDER).toEqual(TILE_ROWS.flat());
  });
});

describe('tileNameParts — 약칭을 보여 주되 접근 가능한 이름에는 공식 명칭을 담는다', () => {
  it('공식 명칭이 약칭으로 시작하면 나머지만 숨은 글자로 잇는다', () => {
    expect(tileNameParts('서울', '서울특별시')).toEqual({
      visible: '서울',
      hiddenSuffix: '특별시',
    });
    expect(tileNameParts('경기', '경기도')).toEqual({ visible: '경기', hiddenSuffix: '도' });
  });

  it('약칭이 공식 명칭의 앞부분이 아니면 공식 명칭 전체를 괄호로 덧붙인다', () => {
    expect(tileNameParts('경남', '경상남도')).toEqual({
      visible: '경남',
      hiddenSuffix: ' (경상남도)',
    });
  });

  it('모든 시·도에서 보이는 글자는 약칭 그대로다 (보이는 이름이 접근 가능한 이름에 들어간다)', () => {
    for (const code of REGION_ORDER) {
      const { short, officialKo } = REGION_BY_CODE[code];
      const parts = tileNameParts(short, officialKo);
      expect(parts.visible).toBe(short);
      expect(`${parts.visible}${parts.hiddenSuffix}`).toContain(officialKo);
    }
  });
});
