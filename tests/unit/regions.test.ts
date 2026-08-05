import { describe, expect, it } from 'vitest';

import { codeFromOfficial, REGIONS, REGION_ORDER } from '@/lib/constants/regions';

describe('지역 코드 매핑', () => {
  it('개칭 전후 강원도와 전라북도를 같은 행정표준코드로 매핑한다', () => {
    expect(codeFromOfficial('강원도')).toBe('42');
    expect(codeFromOfficial('강원특별자치도')).toBe('42');
    expect(codeFromOfficial('전라북도')).toBe('45');
    expect(codeFromOfficial('전북특별자치도')).toBe('45');
  });

  it('KOSIS 자체코드 07a를 세종 코드 36으로 보존한다', () => {
    expect(REGIONS.find((region) => region.kosisEduC1 === '07a')?.code).toBe('36');
  });

  it('미상 지역명은 전국값으로 대체하지 않고 null을 반환한다', () => {
    expect(codeFromOfficial('알 수 없는 지역')).toBeNull();
  });

  it('전국을 제외한 시도 순서는 17개이며 중복이 없다', () => {
    expect(REGION_ORDER).toHaveLength(17);
    expect(new Set(REGION_ORDER).size).toBe(REGION_ORDER.length);
  });
});
