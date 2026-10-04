import { readFileSync } from 'node:fs';

import type { ExtendedFeatureCollection as FeatureCollection } from 'd3-geo';
import { describe, expect, it } from 'vitest';

import {
  createKoreaProjectionLayout,
  remoteIslandGroups,
  splitKoreaGeo,
  toD3Winding,
} from '@/lib/visualization/projection';
import { geoPath } from 'd3-geo';

// 도서 인셋에 이름표를 달려면 울릉도와 독도를 서로 다른 묶음으로 알아야 한다.

const geo = JSON.parse(
  readFileSync(new URL('../../public/geo/sido.geo.json', import.meta.url), 'utf8'),
) as FeatureCollection;

describe('remoteIslandGroups', () => {
  const groups = remoteIslandGroups(splitKoreaGeo(toD3Winding(geo)).inset);

  it('울릉도와 독도를 서쪽에서 동쪽 순서로 나눈다', () => {
    expect(groups.map((group) => group.id)).toEqual(['ulleungdo', 'dokdo']);
  });

  it('각 묶음의 폴리곤이 실제 위치 범위 안에 있다', () => {
    const longitudes = (id: string) =>
      groups
        .find((group) => group.id === id)!
        .geometry.coordinates.flatMap((polygon) => polygon[0]!.map(([longitude]) => longitude));

    // 울릉도 약 130.8~130.95°E, 독도 약 131.86~131.88°E
    expect(Math.min(...longitudes('ulleungdo'))).toBeGreaterThan(130.5);
    expect(Math.max(...longitudes('ulleungdo'))).toBeLessThan(131.2);
    expect(Math.min(...longitudes('dokdo'))).toBeGreaterThan(131.5);
    expect(Math.max(...longitudes('dokdo'))).toBeLessThan(132.2);
  });

  it('인셋 대상이 없으면 빈 배열이다', () => {
    expect(remoteIslandGroups({ type: 'FeatureCollection', features: [] })).toEqual([]);
  });
});

describe('createKoreaProjectionLayout', () => {
  const d3Geo = toD3Winding(geo);
  const mainland = splitKoreaGeo(d3Geo).main;

  // 지도 폭 = 컨테이너 폭, 높이 = max(280, 폭 × 0.88) (ChoroplethMap 의 dimensionsForWidth)
  it.each([232, 256, 296, 328, 420, 760])(
    '폭 %ipx 에서 본토가 도서 인셋 상자와 겹치지 않는다',
    (width) => {
      const height = Math.max(280, width * 0.88);
      const layout = createKoreaProjectionLayout(d3Geo, width, height);
      const [, [right]] = geoPath(layout.main).bounds(mainland);

      expect(layout.insetBox).not.toBeNull();
      expect(right).toBeLessThanOrEqual(layout.insetBox!.x + 0.5);
    },
  );
});
