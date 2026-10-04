import type { RegionCode } from '@/lib/schema';

/**
 * 타일 모자이크 배치 — 17개 시·도를 4열 격자에 지리적 위치에 가깝게 놓는다.
 *
 *   인천 서울 경기 강원
 *   충남 세종 충북 경북
 *   전북 대전 대구 울산
 *   전남 광주 경남 부산
 *   제주
 *
 * 지도를 대신하지 않는다. 좁은 화면에서 작은 단계구분도보다 읽기 쉬운 개요이자,
 * 지역 페이지로 가는 길이다. 지역은 이름이 아니라 코드로 가리킨다.
 */
export const TILE_COLUMNS = 4;

export const TILE_ROWS: readonly (readonly RegionCode[])[] = [
  ['28', '11', '41', '42'],
  ['44', '36', '43', '47'],
  ['45', '30', '27', '31'],
  ['46', '29', '48', '26'],
  ['50'],
];

/** 읽는 순서(행 우선) — DOM 순서이자 Tab 순서. */
export const TILE_ORDER: readonly RegionCode[] = TILE_ROWS.flat();

/**
 * 타일에는 약칭(서울)을 보여 주되 접근 가능한 이름에는 공식 명칭을 담는다.
 * 보이는 글자가 이름에 그대로 들어가야 음성 제어로 부를 수 있으므로 (WCAG 2.5.3),
 * 약칭을 숨기지 않고 뒤에 숨은 글자를 덧붙인다.
 */
export function tileNameParts(
  short: string,
  officialKo: string,
): { visible: string; hiddenSuffix: string } {
  return officialKo.startsWith(short)
    ? { visible: short, hiddenSuffix: officialKo.slice(short.length) }
    : { visible: short, hiddenSuffix: ` (${officialKo})` };
}
