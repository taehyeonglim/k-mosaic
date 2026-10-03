import { describe, expect, it } from 'vitest';

import { fillTemplate, formatYearRange } from '@/content/template';

describe('콘텐츠 템플릿', () => {
  it('자리표시자를 값으로 바꾼다', () => {
    expect(fillTemplate('{start}~{end}년', { start: 2020, end: 2025 })).toBe('2020~2025년');
  });

  it('값이 없는 자리표시자는 오류로 막는다', () => {
    expect(() => fillTemplate('{start}~{end}년', { start: 2020 })).toThrow('end');
  });

  it('연도 목록에서 수록 기간을 만든다', () => {
    expect(formatYearRange([2021, 2020, 2025])).toEqual({ start: 2020, end: 2025 });
  });

  it('빈 연도 목록은 오류로 막는다', () => {
    expect(() => formatYearRange([])).toThrow();
  });
});
