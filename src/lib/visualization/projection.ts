import { geoMercator, geoPath } from 'd3-geo';
import type { ExtendedFeatureCollection as FeatureCollection, GeoProjection } from 'd3-geo';

type Ring = [number, number][];
type PolygonCoordinates = Ring[];
type GeoFeature = FeatureCollection['features'][number];
type GeoGeometry = Exclude<GeoFeature['geometry'], null>;

const REMOTE_ISLAND_MIN_LONGITUDE = 130.5;

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

export interface KoreaGeoParts {
  main: FeatureCollection;
  inset: FeatureCollection;
}

function polygonContainsRemoteIsland(polygon: PolygonCoordinates): boolean {
  return polygon.some((ring) =>
    ring.some(([longitude]) => longitude >= REMOTE_ISLAND_MIN_LONGITUDE),
  );
}

function featureWithPolygons(
  feature: GeoFeature,
  geometry: GeoGeometry,
  polygons: PolygonCoordinates[],
): GeoFeature | null {
  if (polygons.length === 0) return null;

  const coordinates = geometry.type === 'Polygon' ? polygons[0] : polygons;
  if (coordinates === undefined) return null;

  return {
    ...feature,
    geometry: {
      ...geometry,
      coordinates: coordinates as never,
    },
  } as GeoFeature;
}

/**
 * 본토 투영과 도서 인셋에 사용할 폴리곤을 분리한다.
 *
 * 경상북도 피처 안의 울릉도·독도는 본토와 같은 행정 피처에 속하지만, 실제 경도 범위가
 * 너무 멀리 떨어져 있어 본토와 함께 fitExtent 하면 본토가 화면 왼쪽으로 밀린다. 원본
 * GeoJSON은 수정하지 않고 렌더링 계층에서 해당 MultiPolygon의 원거리 폴리곤만 분리한다.
 */
export function splitKoreaGeo(geo: FeatureCollection): KoreaGeoParts {
  const mainFeatures: GeoFeature[] = [];
  const insetFeatures: GeoFeature[] = [];

  for (const feature of geo.features) {
    const geometry = feature.geometry;
    if (geometry === null || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
      mainFeatures.push(feature);
      continue;
    }

    const polygons: PolygonCoordinates[] =
      geometry.type === 'Polygon'
        ? [geometry.coordinates as unknown as PolygonCoordinates]
        : (geometry.coordinates as unknown as PolygonCoordinates[]);
    const mainPolygons = polygons.filter((polygon) => !polygonContainsRemoteIsland(polygon));
    const insetPolygons = polygons.filter(polygonContainsRemoteIsland);
    const mainFeature = featureWithPolygons(feature, geometry, mainPolygons);
    const insetFeature = featureWithPolygons(feature, geometry, insetPolygons);

    if (mainFeature !== null) mainFeatures.push(mainFeature);
    if (insetFeature !== null) insetFeatures.push(insetFeature);
  }

  return {
    main: { ...geo, features: mainFeatures },
    inset: { ...geo, features: insetFeatures },
  };
}

export interface KoreaInsetBox {
  x: number;
  y: number;
  width: number;
  height: number;
  mapExtent: [[number, number], [number, number]];
}

export interface KoreaProjectionLayout {
  main: GeoProjection;
  inset: GeoProjection | null;
  insetBox: KoreaInsetBox | null;
}

function safeDimensions(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function mapPadding(width: number, height: number): number {
  const minimumDimension = Math.min(width, height);
  return Math.min(minimumDimension / 2, Math.max(2, Math.min(24, minimumDimension * 0.05)));
}

function fitMainlandProjection(
  mainGeo: FeatureCollection,
  fallbackGeo: FeatureCollection,
  width: number,
  height: number,
  right?: number,
): GeoProjection {
  const padding = mapPadding(width, height);
  const extent: [[number, number], [number, number]] = [
    [padding, padding],
    [Math.max(padding, right ?? width - padding), height - padding],
  ];
  const object = mainGeo.features.length > 0 ? mainGeo : fallbackGeo;
  return geoMercator().fitExtent(extent, object);
}

function projectedWidth(projection: GeoProjection, geo: FeatureCollection): number {
  const bounds = geoPath(projection).bounds(geo);
  return bounds[1][0] - bounds[0][0];
}

export function createKoreaProjection(
  geo: FeatureCollection,
  width: number,
  height: number,
): GeoProjection {
  const dimensions = safeDimensions(width, height);
  const parts = splitKoreaGeo(geo);
  return fitMainlandProjection(parts.main, geo, dimensions.width, dimensions.height);
}

export function createKoreaProjectionLayout(
  geo: FeatureCollection,
  width: number,
  height: number,
): KoreaProjectionLayout {
  const dimensions = safeDimensions(width, height);
  const parts = splitKoreaGeo(geo);
  const main = fitMainlandProjection(parts.main, geo, dimensions.width, dimensions.height);

  if (parts.inset.features.length === 0) {
    return { main, inset: null, insetBox: null };
  }

  const padding = mapPadding(dimensions.width, dimensions.height);
  const availableWidth = Math.max(1, dimensions.width - padding * 2);
  const availableHeight = Math.max(1, dimensions.height - padding * 2);
  const insetWidth = Math.min(150, Math.max(84, availableWidth * 0.3), availableWidth);
  const insetHeight = Math.min(118, Math.max(82, availableHeight * 0.2), availableHeight);
  const insetX = dimensions.width - padding - insetWidth;
  const insetY = padding;
  const insetLabelHeight = Math.min(
    28,
    Math.max(18, insetHeight * 0.25),
    Math.max(1, insetHeight - 8),
  );
  const insetMapPadding = Math.min(8, Math.max(2, insetWidth * 0.06));
  const insetBox: KoreaInsetBox = {
    x: insetX,
    y: insetY,
    width: insetWidth,
    height: insetHeight,
    mapExtent: [
      [insetX + insetMapPadding, insetY + insetLabelHeight],
      [insetX + insetWidth - insetMapPadding, insetY + insetHeight - insetMapPadding],
    ],
  };

  const fullMainWidth = projectedWidth(main, parts.main);
  const reservedMainWidth = insetX - padding;
  const mainWithInsetSpace =
    fullMainWidth <= reservedMainWidth
      ? fitMainlandProjection(parts.main, geo, dimensions.width, dimensions.height, insetX)
      : main;

  return {
    main: mainWithInsetSpace,
    inset: geoMercator().fitExtent(insetBox.mapExtent, parts.inset),
    insetBox,
  };
}
