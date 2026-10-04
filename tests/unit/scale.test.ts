import { describe, expect, it } from 'vitest';

import { createCountScale, createRateScale, legendSegments } from '@/lib/visualization/scale';

// 지도 색 척도. 학생 수(분위)와 비율(등간격)이 같은 단일 색상 램프(--km-ramp-1..7)를 쓴다.
// step() 은 지도와 타일 모자이크가 같은 단계를 쓰게 하는 공용 값이다.

const COUNTS = [
  886, 3429, 3959, 4076, 5249, 5403, 6553, 8001, 8117, 9244, 11290, 13196, 14004, 14833, 15005,
  22002, 56961,
];

describe('createCountScale (분위)', () => {
  const scale = createCountScale(COUNTS);

  it('가장 작은 값은 1단계, 가장 큰 값은 7단계다', () => {
    expect(scale.step(886)).toBe(1);
    expect(scale.step(56961)).toBe(7);
  });

  it('결측은 단계가 없다 — 0 으로 취급하지 않는다', () => {
    expect(scale.step(null)).toBeNull();
    expect(scale.step(Number.NaN)).toBeNull();
    expect(scale.color(null)).toBe(scale.missingColor);
  });

  it('색은 단계에 대응하는 단일 램프 토큰이다', () => {
    for (const value of COUNTS) {
      expect(scale.color(value)).toBe(`var(--km-ramp-${scale.step(value)})`);
    }
  });

  it('값이 커질수록 단계가 내려가지 않는다', () => {
    const steps = COUNTS.map((value) => scale.step(value)!);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  it('경계값은 최솟값·분위 6개·최댓값, 오름차순 8개다', () => {
    const breaks = scale.breaks();
    expect(breaks).toHaveLength(8);
    expect(breaks[0]).toBe(886);
    expect(breaks[7]).toBe(56961);
    expect(breaks).toEqual([...breaks].sort((a, b) => a - b));
  });
});

describe('createRateScale (등간격)', () => {
  const scale = createRateScale([1, 2.5, 4, 8]);

  it('경계값은 최솟값부터 최댓값까지 같은 간격의 8개다', () => {
    expect(scale.breaks()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('구간에 맞는 단계를 준다', () => {
    expect(scale.step(1)).toBe(1);
    expect(scale.step(2.5)).toBe(2);
    expect(scale.step(4)).toBe(4);
    expect(scale.step(8)).toBe(7);
  });

  it('학생 수와 같은 램프 토큰을 쓴다', () => {
    expect(scale.color(8)).toBe('var(--km-ramp-7)');
    expect(scale.color(1)).toBe('var(--km-ramp-1)');
  });
});

describe('값이 하나도 없을 때', () => {
  it.each([
    ['학생 수', createCountScale([null, null])],
    ['비율', createRateScale([])],
  ])('%s 척도는 단계·경계가 없다', (_, scale) => {
    expect(scale.step(10)).toBeNull();
    expect(scale.color(10)).toBe(scale.missingColor);
    expect(scale.breaks()).toEqual([]);
    expect(legendSegments(scale)).toEqual([]);
  });
});

describe('legendSegments', () => {
  it('7개 구간이 순서대로 1~7단계 색과 경계를 갖는다', () => {
    const scale = createRateScale([1, 8]);
    const segments = legendSegments(scale);

    expect(segments.map((segment) => segment.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(segments.map((segment) => segment.color)).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((step) => `var(--km-ramp-${step})`),
    );
    expect(segments[0]).toMatchObject({ lower: 1, upper: 2 });
    expect(segments[6]).toMatchObject({ lower: 7, upper: 8 });
  });

  it('분위 척도에서도 구간 수는 7개이고 경계가 이어진다', () => {
    const segments = legendSegments(createCountScale(COUNTS));

    expect(segments).toHaveLength(7);
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index]!.lower).toBe(segments[index - 1]!.upper);
    }
  });
});
