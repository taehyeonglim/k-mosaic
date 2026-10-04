/**
 * 순위 표의 인라인 막대 기하 — 순수 함수.
 *
 * 막대는 언제나 0 기준선에서 출발하고 길이는 값에 비례한다. 증감처럼 음수가 섞이면
 * 기준선이 트랙 안쪽으로 들어오고, 음수 막대는 기준선 왼쪽으로 뻗는다.
 */

export interface BarDomain {
  min: number;
  max: number;
}

export interface BarGeometry {
  /** 트랙 왼쪽 끝에서 막대가 시작하는 위치(%) */
  offset: number;
  /** 막대 길이(%) */
  length: number;
  direction: 'positive' | 'negative' | 'zero';
}

/** 0 을 포함하는 값 범위. 결측(null)은 0 으로 취급하지 않고 뺀다. */
export function barDomain(values: readonly (number | null)[]): BarDomain {
  const present = values.filter((value): value is number => value !== null);
  return { min: Math.min(0, ...present), max: Math.max(0, ...present) };
}

export function barGeometry(value: number, domain: BarDomain): BarGeometry {
  const span = domain.max - domain.min;
  if (span === 0 || value === 0) {
    return { offset: span === 0 ? 0 : percent(-domain.min, span), length: 0, direction: 'zero' };
  }
  const baseline = percent(-domain.min, span);
  const length = percent(Math.abs(value), span);
  return value > 0
    ? { offset: baseline, length, direction: 'positive' }
    : { offset: baseline - length, length, direction: 'negative' };
}

function percent(part: number, whole: number): number {
  // 부동소수점 오차(0.1 + 0.2 류)가 화면 폭 계산과 테스트 비교에 새지 않게 다듬는다.
  // '+ 0' 은 -0 을 0 으로 바꾼다 (min 이 0 일 때 -min 이 -0 이 된다).
  return Math.round((part / whole) * 1e6) / 1e4 + 0;
}
