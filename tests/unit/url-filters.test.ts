import { describe, expect, it } from 'vitest';

import { applyQueryUpdates, readRegions, readYear, toggleRegion } from '@/lib/url-filters';

describe('URL 필터', () => {
  it('수록 연도가 아니면 최신 연도로 돌아간다', () => {
    expect(readYear(new URLSearchParams('year=2022'), [2020, 2022, 2025])).toBe(2022);
    expect(readYear(new URLSearchParams('year=1999'), [2020, 2022, 2025])).toBe(2025);
    expect(readYear(new URLSearchParams(''), [2020, 2025])).toBe(2025);
  });

  it('지역은 유효한 코드만 중복 없이 최대 3개, 초과 여부를 알린다', () => {
    expect(readRegions(new URLSearchParams('regions=11,xx,11,26'))).toEqual({
      regions: ['11', '26'],
      hasTooManyRegions: false,
    });
    expect(readRegions(new URLSearchParams('regions=11,26,27,28'))).toEqual({
      regions: ['11', '26', '27'],
      hasTooManyRegions: true,
    });
  });

  it('지역 토글: 추가·제거·최대 초과·지역 밖 클릭', () => {
    expect(toggleRegion(['11'], '26', null)).toEqual({
      regions: ['11', '26'],
      limitReached: false,
    });
    expect(toggleRegion(['11', '26'], '11', null)).toEqual({
      regions: ['26'],
      limitReached: false,
    });
    expect(toggleRegion(['11', '26', '27'], '28', null)).toEqual({
      regions: null,
      limitReached: true,
    });
    expect(toggleRegion(['11', '26'], null, '26')).toEqual({
      regions: ['11'],
      limitReached: false,
    });
    expect(toggleRegion(['11'], 'xx', null)).toEqual({ regions: null, limitReached: false });
  });

  it('쿼리 갱신: 빈 배열·null 은 삭제, 나머지는 덮어쓴다', () => {
    expect(applyQueryUpdates('year=2024&regions=11', { year: 2025, regions: [] })).toBe(
      'year=2025',
    );
    expect(applyQueryUpdates('', { regions: ['11', '26'], metric: 'rate' })).toBe(
      'regions=11%2C26&metric=rate',
    );
  });
});
