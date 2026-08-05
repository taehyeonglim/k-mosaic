// 17개 시·도 코드 매핑 (행정표준코드 시도 2자리)
//
// 왜 코드로 고정하는가:
//   e-나라지표는 약칭("강원"), KOSIS 교육기본통계는 정식명("강원특별자치도")을 쓴다.
//   게다가 정식명은 시계열 도중에 바뀐다 (2023 강원도→강원특별자치도, 2024 전라북도→전북특별자치도).
//   따라서 이름은 표시용일 뿐이고, 조인 키는 항상 regionCode 여야 한다.
//
// KOSIS 교육기본통계 개황표의 C1 코드는 행정표준코드와 무관한 자체 순번이며
// 세종이 '07a' 로 울산(07)과 경기(08) 사이에 삽입돼 있다 (세종시 출범 2012년 이후 추가된 흔적).
// 이 자체 순번도 함께 보존해 원자료 추적이 가능하게 한다.

export const REGIONS = [
  { code: '11', kosisEduC1: '01', short: '서울', officialKo: '서울특별시',     en: 'Seoul' },
  { code: '26', kosisEduC1: '02', short: '부산', officialKo: '부산광역시',     en: 'Busan' },
  { code: '27', kosisEduC1: '03', short: '대구', officialKo: '대구광역시',     en: 'Daegu' },
  { code: '28', kosisEduC1: '04', short: '인천', officialKo: '인천광역시',     en: 'Incheon' },
  { code: '29', kosisEduC1: '05', short: '광주', officialKo: '광주광역시',     en: 'Gwangju' },
  { code: '30', kosisEduC1: '06', short: '대전', officialKo: '대전광역시',     en: 'Daejeon' },
  { code: '31', kosisEduC1: '07', short: '울산', officialKo: '울산광역시',     en: 'Ulsan' },
  { code: '36', kosisEduC1: '07a', short: '세종', officialKo: '세종특별자치시', en: 'Sejong' },
  { code: '41', kosisEduC1: '08', short: '경기', officialKo: '경기도',         en: 'Gyeonggi' },
  { code: '42', kosisEduC1: '09', short: '강원', officialKo: '강원특별자치도', en: 'Gangwon' },
  { code: '43', kosisEduC1: '10', short: '충북', officialKo: '충청북도',       en: 'Chungbuk' },
  { code: '44', kosisEduC1: '11', short: '충남', officialKo: '충청남도',       en: 'Chungnam' },
  { code: '45', kosisEduC1: '12', short: '전북', officialKo: '전북특별자치도', en: 'Jeonbuk' },
  { code: '46', kosisEduC1: '13', short: '전남', officialKo: '전라남도',       en: 'Jeonnam' },
  { code: '47', kosisEduC1: '14', short: '경북', officialKo: '경상북도',       en: 'Gyeongbuk' },
  { code: '48', kosisEduC1: '15', short: '경남', officialKo: '경상남도',       en: 'Gyeongnam' },
  { code: '50', kosisEduC1: '16', short: '제주', officialKo: '제주특별자치도', en: 'Jeju' },
];

/** e-나라지표 약칭 → regionCode. 미상이면 null (전국값으로 대체하지 않는다). */
export function codeFromShort(short) {
  return REGIONS.find((r) => r.short === short)?.code ?? null;
}

/** KOSIS 개황표 C1_NM(정식명) → regionCode. 개칭 이전 표기도 함께 받는다. */
const LEGACY_OFFICIAL = {
  강원도: '42',
  전라북도: '45',
};
export function codeFromOfficial(officialKo) {
  return (
    REGIONS.find((r) => r.officialKo === officialKo)?.code ??
    LEGACY_OFFICIAL[officialKo] ??
    null
  );
}

export const REGION_BY_CODE = Object.fromEntries(REGIONS.map((r) => [r.code, r]));
