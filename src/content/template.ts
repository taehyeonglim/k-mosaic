// 콘텐츠 사전(ko.ts)의 `{name}` 자리표시자를 채운다.
//
// 연도처럼 데이터에서 파생되는 값을 문구에 리터럴로 박아 두면 데이터 갱신 때
// 화면이 사실과 달라진다. 문구는 템플릿으로 두고 값은 데이터에서 넣는다.

export function fillTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`템플릿 값이 없습니다: ${name}`);
    return String(value);
  });
}

/** 공표 비율 정수 반올림 안내 — 해당 연도가 없으면 null (안내를 표시하지 않는다). */
export function formatRatePrecisionNote(
  template: string,
  roundedYears: readonly number[],
): string | null {
  return roundedYears.length === 0
    ? null
    : fillTemplate(template, { years: roundedYears.join('·') });
}

export function formatYearRange(years: readonly number[]): { start: number; end: number } {
  if (years.length === 0) throw new Error('수록 연도가 비어 있습니다.');
  return { start: Math.min(...years), end: Math.max(...years) };
}
