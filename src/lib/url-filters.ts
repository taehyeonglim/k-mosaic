import { regionCodeSchema, type RegionCode } from './schema/index';

// URL 쿼리 필터 해석 — 대시보드와 외국인 유학생 페이지가 공유하는 순수 함수.
// 필터 상태를 URL 에 두어 화면을 그대로 공유할 수 있게 한다.

export const MAX_COMPARE_REGIONS = 3;

/** ?year= 가 수록 연도면 그 값, 아니면 최신 연도. */
export function readYear(params: URLSearchParams, years: readonly number[]): number {
  const fallback = years[years.length - 1] ?? years[0] ?? 0;
  const requested = Number(params.get('year'));
  return Number.isInteger(requested) && years.includes(requested) ? requested : fallback;
}

/** ?regions= 의 유효한 지역 코드(중복 제거, 최대 3개)와 초과 여부. */
export function readRegions(
  params: URLSearchParams,
  max = MAX_COMPARE_REGIONS,
): { regions: RegionCode[]; hasTooManyRegions: boolean } {
  const parsed = (params.get('regions') ?? '').split(',').flatMap((token) => {
    const result = regionCodeSchema.safeParse(token);
    return result.success ? [result.data] : [];
  });
  return { regions: [...new Set(parsed)].slice(0, max), hasTooManyRegions: parsed.length > max };
}

/**
 * 지도에서 지역을 눌렀을 때의 다음 선택. 이미 있으면 빼고, 없으면 더하되 최대 개수를
 * 넘으면 그대로 두고 limitReached 를 알린다. 지역 밖(null)을 누르면 기준 지역을 뺀다.
 */
export function toggleRegion(
  current: readonly RegionCode[],
  code: string | null,
  focused: RegionCode | null,
  max = MAX_COMPARE_REGIONS,
): { regions: RegionCode[] | null; limitReached: boolean } {
  if (code === null) {
    return {
      regions: focused === null ? null : current.filter((region) => region !== focused),
      limitReached: false,
    };
  }
  const parsed = regionCodeSchema.safeParse(code);
  if (!parsed.success) return { regions: null, limitReached: false };
  if (current.includes(parsed.data))
    return { regions: current.filter((region) => region !== parsed.data), limitReached: false };
  if (current.length >= max) return { regions: null, limitReached: true };
  return { regions: [...current, parsed.data], limitReached: false };
}

/** 쿼리 갱신: null 은 키 삭제, 배열은 쉼표로 잇고 빈 배열은 삭제한다. */
export function applyQueryUpdates(
  searchString: string,
  updates: Readonly<Record<string, string | number | readonly string[] | null | undefined>>,
): string {
  const next = new URLSearchParams(searchString);
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (value === null || (Array.isArray(value) && value.length === 0)) next.delete(key);
    else next.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return next.toString();
}
