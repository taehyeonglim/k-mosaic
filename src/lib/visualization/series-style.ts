/**
 * 시계열 계열의 색·마커·선 모양 배정 — 순수 함수.
 *
 * - 계열이 하나면 브랜드색. 범례 없이 면 채움과 끝점 라벨을 붙이는 단독 계열이다.
 * - 둘 이상이면 범주색 자리(1~3)를 순서대로 준다. `slot` 을 명시하면 그 자리를 쓴다 —
 *   비교 지역을 더하거나 빼도 남은 지역의 색이 바뀌지 않게 하려는 것이다.
 * - 기준 계열(전국 값)은 범주색이 아니라 중립색 점선이다. 브랜드 청록은 범주색으로 쓰기에
 *   채도가 낮아(검증기 chroma floor 미달) 다른 계열과 나란히 놓지 않는다.
 *
 * 범주색 3종은 색각 이상 전 쌍 검증을 통과한 값이다 (docs/design-system.md §2).
 */

export type MarkerShape = 'circle' | 'diamond' | 'triangle' | 'square';
export type SeriesSlot = 1 | 2 | 3;

export interface SeriesStyleInput {
  regionCode: string;
  slot?: SeriesSlot;
  reference?: boolean;
}

export interface SeriesStyle {
  regionCode: string;
  color: string;
  shape: MarkerShape;
  dashed: boolean;
  /** 단독 계열 — 범례 없이 면 채움과 끝점 라벨을 붙인다. */
  solo: boolean;
}

const SLOT_SHAPES: Record<SeriesSlot, MarkerShape> = { 1: 'circle', 2: 'diamond', 3: 'triangle' };
const BRAND_COLOR = 'var(--km-ramp-5)';
const REFERENCE_COLOR = 'var(--km-color-text-muted)';

export function resolveSeriesStyles(series: readonly SeriesStyleInput[]): SeriesStyle[] {
  const only = series.length === 1 ? series[0] : undefined;
  const solo = only !== undefined && only.slot === undefined && only.reference !== true;
  let implicitSlot = 0;

  return series.map(({ regionCode, slot, reference }) => {
    if (reference === true) {
      return { regionCode, color: REFERENCE_COLOR, shape: 'square', dashed: true, solo: false };
    }
    if (solo) {
      return { regionCode, color: BRAND_COLOR, shape: 'circle', dashed: false, solo: true };
    }
    implicitSlot += 1;
    const resolved = slot ?? (Math.min(implicitSlot, 3) as SeriesSlot);
    return {
      regionCode,
      color: `var(--km-series-${resolved})`,
      shape: SLOT_SHAPES[resolved],
      dashed: false,
      solo: false,
    };
  });
}
