import { describe, expect, it } from 'vitest';

import { codeFromOfficial, REGIONS, REGION_ORDER } from '@/lib/constants/regions';
import { regionCodeSchema } from '@/lib/schema/dimensions';

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

  it('스키마의 지역 코드 목록과 매핑표가 정확히 같다 (사본 불일치 방지)', () => {
    // schema/dimensions.ts 는 순환 import 를 피하려고 코드 목록을 따로 둔다. 둘이 어긋나면
    // 스키마는 통과하는데 매핑에서 빠지는 지역이 생긴다.
    expect([...regionCodeSchema.options].sort()).toEqual(REGIONS.map(({ code }) => code).sort());
  });

  it('KOSIS 교육기본통계 시도 코드는 모두 다르고 세종은 07a 다', () => {
    const kosisCodes = REGIONS.map(({ kosisEduC1 }) => kosisEduC1);
    expect(new Set(kosisCodes).size).toBe(REGIONS.length);
    expect(REGIONS.find(({ code }) => code === '36')?.kosisEduC1).toBe('07a');
  });
});
