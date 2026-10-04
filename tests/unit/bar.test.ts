import { describe, expect, it } from 'vitest';

import { barDomain, barGeometry } from '@/lib/visualization/bar';

// 순위 표의 인라인 막대 — 길이는 값에 비례하고 0 기준선에서 출발한다.
// 증감처럼 음수가 섞이면 기준선이 트랙 안쪽으로 들어오고 음수 막대는 왼쪽으로 뻗는다.

describe('barDomain', () => {
  it('양수만 있으면 0 에서 최댓값까지다', () => {
    expect(barDomain([10, 40, 25])).toEqual({ min: 0, max: 40 });
  });

  it('음수가 섞이면 최솟값부터 최댓값까지다', () => {
    expect(barDomain([-50, 0, 150])).toEqual({ min: -50, max: 150 });
  });

  it('음수만 있어도 0 을 포함한다', () => {
    expect(barDomain([-10, -4])).toEqual({ min: -10, max: 0 });
  });

  it('결측(null)은 범위 계산에서 뺀다 — 0 으로 취급하지 않는다', () => {
    expect(barDomain([null, 30, null])).toEqual({ min: 0, max: 30 });
    expect(barDomain([null, -30])).toEqual({ min: -30, max: 0 });
  });

  it('값이 없으면 빈 범위다', () => {
    expect(barDomain([])).toEqual({ min: 0, max: 0 });
    expect(barDomain([null])).toEqual({ min: 0, max: 0 });
  });
});

describe('barGeometry', () => {
  it('양수 범위에서 최댓값은 트랙을 가득 채우고 절반 값은 절반을 채운다', () => {
    const domain = { min: 0, max: 200 };
    expect(barGeometry(200, domain)).toEqual({ offset: 0, length: 100, direction: 'positive' });
    expect(barGeometry(100, domain)).toEqual({ offset: 0, length: 50, direction: 'positive' });
  });

  it('음수가 섞인 범위에서 양수 막대는 기준선에서 오른쪽으로 뻗는다', () => {
    expect(barGeometry(150, { min: -50, max: 150 })).toEqual({
      offset: 25,
      length: 75,
      direction: 'positive',
    });
  });

  it('음수 막대는 기준선에서 왼쪽으로 뻗는다', () => {
    expect(barGeometry(-50, { min: -50, max: 150 })).toEqual({
      offset: 0,
      length: 25,
      direction: 'negative',
    });
    expect(barGeometry(-20, { min: -50, max: 150 })).toEqual({
      offset: 15,
      length: 10,
      direction: 'negative',
    });
  });

  it('0 은 기준선 위의 길이 없는 막대다', () => {
    expect(barGeometry(0, { min: -50, max: 150 })).toEqual({
      offset: 25,
      length: 0,
      direction: 'zero',
    });
  });

  it('음수만 있는 범위에서 최솟값은 트랙을 가득 채운다', () => {
    expect(barGeometry(-10, { min: -10, max: 0 })).toEqual({
      offset: 0,
      length: 100,
      direction: 'negative',
    });
  });

  it('빈 범위(모든 값이 0 이거나 없음)에서는 길이가 0 이다 — NaN 을 내지 않는다', () => {
    expect(barGeometry(0, { min: 0, max: 0 })).toEqual({ offset: 0, length: 0, direction: 'zero' });
  });
});
