import type { RegionCode } from '@/lib/schema';

export const REGIONS = [
  { code: '11', kosisEduC1: '01', short: '서울', officialKo: '서울특별시', en: 'Seoul' },
  { code: '26', kosisEduC1: '02', short: '부산', officialKo: '부산광역시', en: 'Busan' },
  { code: '27', kosisEduC1: '03', short: '대구', officialKo: '대구광역시', en: 'Daegu' },
  { code: '28', kosisEduC1: '04', short: '인천', officialKo: '인천광역시', en: 'Incheon' },
  { code: '29', kosisEduC1: '05', short: '광주', officialKo: '광주광역시', en: 'Gwangju' },
  { code: '30', kosisEduC1: '06', short: '대전', officialKo: '대전광역시', en: 'Daejeon' },
  { code: '31', kosisEduC1: '07', short: '울산', officialKo: '울산광역시', en: 'Ulsan' },
  { code: '36', kosisEduC1: '07a', short: '세종', officialKo: '세종특별자치시', en: 'Sejong' },
  { code: '41', kosisEduC1: '08', short: '경기', officialKo: '경기도', en: 'Gyeonggi' },
  { code: '42', kosisEduC1: '09', short: '강원', officialKo: '강원특별자치도', en: 'Gangwon' },
  { code: '43', kosisEduC1: '10', short: '충북', officialKo: '충청북도', en: 'Chungbuk' },
  { code: '44', kosisEduC1: '11', short: '충남', officialKo: '충청남도', en: 'Chungnam' },
  { code: '45', kosisEduC1: '12', short: '전북', officialKo: '전북특별자치도', en: 'Jeonbuk' },
  { code: '46', kosisEduC1: '13', short: '전남', officialKo: '전라남도', en: 'Jeonnam' },
  { code: '47', kosisEduC1: '14', short: '경북', officialKo: '경상북도', en: 'Gyeongbuk' },
  { code: '48', kosisEduC1: '15', short: '경남', officialKo: '경상남도', en: 'Gyeongnam' },
  { code: '50', kosisEduC1: '16', short: '제주', officialKo: '제주특별자치도', en: 'Jeju' },
] as const satisfies ReadonlyArray<{
  code: RegionCode;
  kosisEduC1: string;
  short: string;
  officialKo: string;
  en: string;
}>;

const LEGACY_OFFICIAL: Record<string, RegionCode> = {
  강원도: '42',
  전라북도: '45',
};

export const REGION_BY_CODE = Object.fromEntries(
  REGIONS.map((region) => [region.code, region]),
) as Readonly<Record<RegionCode, (typeof REGIONS)[number]>>;

export const REGION_ORDER: readonly RegionCode[] = REGIONS.map(({ code }) => code);

export function codeFromShort(short: string): RegionCode | null {
  return REGIONS.find((region) => region.short === short)?.code ?? null;
}

export function codeFromOfficial(officialKo: string): RegionCode | null {
  return (
    REGIONS.find((region) => region.officialKo === officialKo)?.code ??
    LEGACY_OFFICIAL[officialKo] ??
    null
  );
}
