import { describe, expect, it } from 'vitest';

import { resolveSeriesStyles } from '@/lib/visualization/series-style';

// 시계열 계열의 색·마커·선 모양 배정.
// - 계열이 하나면 브랜드색(면 채움·끝점 라벨을 붙이는 단독 계열).
// - 둘 이상이면 범주색 자리(1~3)를 순서대로 준다. 자리를 명시하면 그 자리를 쓴다 —
//   비교 지역을 더하거나 빼도 남은 지역의 색이 바뀌지 않게 하기 위함이다.
// - 기준 계열(전국 값)은 범주색이 아니라 중립색 점선이다.

const s = (regionCode: string, extra: object = {}) => ({ regionCode, ...extra });

describe('resolveSeriesStyles', () => {
  it('단독 계열은 브랜드색 실선이고 면 채움 대상이다', () => {
    expect(resolveSeriesStyles([s('KR')])).toEqual([
      { regionCode: 'KR', color: 'var(--km-ramp-5)', shape: 'circle', dashed: false, solo: true },
    ]);
  });

  it('여러 계열은 순서대로 범주색 자리와 서로 다른 마커를 받는다', () => {
    expect(resolveSeriesStyles([s('11'), s('26'), s('27')])).toEqual([
      {
        regionCode: '11',
        color: 'var(--km-series-1)',
        shape: 'circle',
        dashed: false,
        solo: false,
      },
      {
        regionCode: '26',
        color: 'var(--km-series-2)',
        shape: 'diamond',
        dashed: false,
        solo: false,
      },
      {
        regionCode: '27',
        color: 'var(--km-series-3)',
        shape: 'triangle',
        dashed: false,
        solo: false,
      },
    ]);
  });

  it('자리를 명시하면 계열이 하나여도 그 범주색을 쓴다 (나중에 지역을 더해도 색이 유지된다)', () => {
    expect(resolveSeriesStyles([s('11', { slot: 1 })])).toEqual([
      {
        regionCode: '11',
        color: 'var(--km-series-1)',
        shape: 'circle',
        dashed: false,
        solo: false,
      },
    ]);
    expect(resolveSeriesStyles([s('26', { slot: 2 })])[0]).toMatchObject({
      color: 'var(--km-series-2)',
      shape: 'diamond',
    });
  });

  it('기준 계열은 중립색 점선·사각 마커이고 범주색 자리를 쓰지 않는다', () => {
    expect(resolveSeriesStyles([s('11', { slot: 1 }), s('KR', { reference: true })])).toEqual([
      {
        regionCode: '11',
        color: 'var(--km-series-1)',
        shape: 'circle',
        dashed: false,
        solo: false,
      },
      {
        regionCode: 'KR',
        color: 'var(--km-color-text-muted)',
        shape: 'square',
        dashed: true,
        solo: false,
      },
    ]);
  });

  it('기준 계열은 자리 번호를 소모하지 않는다', () => {
    const styles = resolveSeriesStyles([s('KR', { reference: true }), s('11'), s('26')]);
    expect(styles.map((style) => style.color)).toEqual([
      'var(--km-color-text-muted)',
      'var(--km-series-1)',
      'var(--km-series-2)',
    ]);
  });
});
