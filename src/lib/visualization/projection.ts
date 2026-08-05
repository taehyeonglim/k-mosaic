import { geoMercator } from 'd3-geo';
import type { ExtendedFeatureCollection as FeatureCollection, GeoProjection } from 'd3-geo';

type Ring = [number, number][];

function ringIsCounterClockwise(ring: Ring): boolean {
  // 신발끈 공식. 양수면 반시계 방향(RFC 7946 의 외곽 링 규격).
  let twiceArea = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (a === undefined || b === undefined) continue;
    twiceArea += a[0] * b[1] - b[0] * a[1];
  }
  return twiceArea > 0;
}

/**
 * d3-geo 용으로 링 감김 방향을 뒤집는다.
 *
 * 왜 필요한가 — RFC 7946 은 외곽 링을 **반시계** 방향으로 규정하지만, d3-geo 는 GeoJSON 을
 * 구면 기하로 해석해 **시계** 방향 외곽 링을 기대한다. 반시계 링을 그대로 넘기면 d3 는
 * "지구 전체에서 이 지역을 뺀 영역"으로 해석하고, 그 결과 각 지역 path 에 clipExtent
 * 사각형이 통째로 덧붙는다. 화면에서는 마지막에 그려진 지역이 지도 전체를 자기 색으로
 * 덮고 모든 포인터 이벤트를 가로챈다.
 *
 * 수정 위치를 데이터가 아니라 이 계층으로 둔 이유 — `public/geo/sido.geo.json` 은 공개
 * 산출물이므로 RFC 7946 표준을 유지하는 편이 다른 소비자에게 안전하다. d3 고유의 규약
 * 차이는 d3 를 쓰는 곳에서 흡수한다.
 */
export function toD3Winding(geo: FeatureCollection): FeatureCollection {
  return {
    ...geo,
    features: geo.features.map((feature) => {
      const geometry = feature.geometry;
      if (geometry === null || geometry === undefined) return feature;
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return feature;

      const polygons: Ring[][] =
        geometry.type === 'Polygon'
          ? [geometry.coordinates as unknown as Ring[]]
          : (geometry.coordinates as unknown as Ring[][]);

      const rewound = polygons.map((polygon) =>
        polygon.map((ring, index) => {
          // 외곽 링(index 0)은 시계 방향, 구멍은 반시계 방향이어야 한다.
          const wantCounterClockwise = index > 0;
          return ringIsCounterClockwise(ring) === wantCounterClockwise ? ring : [...ring].reverse();
        }),
      );

      return {
        ...feature,
        geometry: {
          ...geometry,
          coordinates: (geometry.type === 'Polygon' ? rewound[0] : rewound) as never,
        },
      };
    }),
  };
}

export function createKoreaProjection(
  geo: FeatureCollection,
  width: number,
  height: number,
): GeoProjection {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const minimumDimension = Math.min(safeWidth, safeHeight);
  const padding = Math.min(
    minimumDimension / 2,
    Math.max(2, Math.min(24, minimumDimension * 0.05)),
  );

  return geoMercator().fitExtent(
    [
      [padding, padding],
      [safeWidth - padding, safeHeight - padding],
    ],
    geo,
  );
}
