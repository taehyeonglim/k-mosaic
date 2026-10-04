import { scaleQuantile, scaleQuantize } from 'd3-scale';

export type ColorScaleKind = 'quantile' | 'sequential';

/** 램프 단계 — 1(가장 옅음)부터 7(가장 짙음). */
export type RampStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ColorScale {
  /** 값이 속한 램프 단계. 결측은 null (0 단계로 취급하지 않는다). */
  step(v: number | null): RampStep | null;
  color(v: number | null): string;
  missingColor: string;
  /** 최솟값 · 단계 경계 6개 · 최댓값 (오름차순 8개). 값이 없으면 빈 배열. */
  breaks(): number[];
  kind: ColorScaleKind;
}

export interface LegendSegment {
  step: RampStep;
  color: string;
  lower: number;
  upper: number;
}

const STEPS: RampStep[] = [1, 2, 3, 4, 5, 6, 7];
const MISSING_COLOR = 'var(--km-color-missing)';

/**
 * 단일 색상 램프. 학생 수와 비율이 같은 램프를 쓴다 — 지표 구분은 범례 제목과 단위가 맡는다.
 * 색 값은 CSS 변수이므로 테마(라이트·다크·잉크 띠)는 쓰이는 자리에서 정해진다.
 */
export function rampColor(step: RampStep): string {
  return `var(--km-ramp-${step})`;
}

/** 램프 위에 올리는 글자색 (타일 라벨) — 모든 단계에서 4.5:1 이상 (tokens.test.ts). */
export function onRampColor(step: RampStep): string {
  return `var(--km-on-ramp-${step})`;
}

function finiteValues(values: readonly (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

function buildScale(
  kind: ColorScaleKind,
  numbers: number[],
  stepOf: (value: number) => RampStep,
  thresholds: () => number[],
): ColorScale {
  const hasData = numbers.length > 0;
  const step = (v: number | null): RampStep | null =>
    !hasData || v === null || !Number.isFinite(v) ? null : stepOf(v);

  return {
    step,
    color(v) {
      const resolved = step(v);
      return resolved === null ? MISSING_COLOR : rampColor(resolved);
    },
    missingColor: MISSING_COLOR,
    breaks() {
      return hasData ? [Math.min(...numbers), ...thresholds(), Math.max(...numbers)] : [];
    },
    kind,
  };
}

/** 학생 수 — 분위(quantile) 척도. 값이 한쪽으로 치우쳐 있어 등간격이면 대부분이 한 단계에 몰린다. */
export function createCountScale(values: readonly (number | null)[]): ColorScale {
  const numbers = finiteValues(values);
  const quantile = scaleQuantile<RampStep>(STEPS).domain(numbers);
  return buildScale(
    'quantile',
    numbers,
    (value) => quantile(value),
    () => quantile.quantiles(),
  );
}

/** 비율 — 최솟값부터 최댓값까지 등간격 7단계. */
export function createRateScale(values: readonly (number | null)[]): ColorScale {
  const numbers = finiteValues(values);
  const quantize = scaleQuantize<RampStep>(STEPS).domain(
    numbers.length > 0 ? [Math.min(...numbers), Math.max(...numbers)] : [0, 1],
  );
  return buildScale(
    'sequential',
    numbers,
    (value) => quantize(value),
    () => quantize.thresholds(),
  );
}

/** 범례용 구간 — 단계마다 색과 아래·위 경계. 값이 없으면 빈 배열. */
export function legendSegments(scale: ColorScale): LegendSegment[] {
  const boundaries = scale.breaks();
  if (boundaries.length !== STEPS.length + 1) return [];
  return STEPS.map((step, index) => ({
    step,
    color: rampColor(step),
    lower: boundaries[index]!,
    upper: boundaries[index + 1]!,
  }));
}
