export const ko = {
  app: {
    title: 'K-MOSAIC',
    subtitle: '대한민국 다문화학생 교육통계 시각화·분석 플랫폼',
    tagline: '여러 언어와 문화를 지닌 학생이 우리 교육에 얼마나 함께하고 있는지 살펴봅니다.',
  },
  nav: {
    overview: '전국 개요',
    map: '지역 지도',
    ranking: '지역 순위',
    trend: '시계열',
    sources: '데이터 출처',
    download: '다운로드',
  },
  overview: {
    title: '전국 개요',
    studentCount: '학생 수',
    rate: '학생 비율',
    previousYear: '전년 대비',
    firstYear: '최초 연도 대비',
    nationwideValue: '전국 값',
    referenceYear: '기준 연도',
    updatedAt: '갱신일',
    computedRate: '직접 계산한 비율',
  },
  filters: {
    title: '필터',
    year: '연도',
    schoolLevel: '학교급',
    schoolLevels: {
      all: '전체',
      elementary: '초등학교',
      middle: '중학교',
      high: '고등학교',
      other: '각종학교',
    },
    metric: '지표',
    metrics: {
      count: '학생 수',
      rate: '비율',
    },
    regions: '지역',
    selectedRegions: '선택 지역',
    maxRegions: '최대 3개 지역까지 비교할 수 있습니다.',
    studentType: '학생 유형',
    studentTypeUnavailable:
      '이 통계는 학생 유형별(국내출생·중도입국·외국인가정) 구분을 제공하지 않습니다.',
    otherSchoolLevelNote: '각종학교는 모수가 작아 비율이 크게 요동칠 수 있습니다.',
  },
  map: {
    title: '17개 시·도 지도',
    description: '지역을 선택하면 상세 정보를 확인할 수 있습니다.',
    countLegend: '학생 수 단계',
    rateLegend: '비율 단계',
    missingLegend: '데이터 없음',
    selectRegion: '지역 선택',
    selected: '선택됨',
    keyboardHint: 'Tab으로 지역을 이동하고 Enter 또는 Space로 선택합니다.',
    scaleNote: '연도별 비교를 위해 기본 척도를 고정합니다.',
  },
  ranking: {
    title: '지역 순위',
    count: '학생 수 순위',
    rate: '비율 순위',
    deltaAbs: '절대 증가 인원 순위',
    deltaPct: '증가율 순위',
    rank: '순위',
    region: '지역',
    value: '값',
    noData: '데이터 없음',
    interpretationNote: '순위는 교육의 우열이나 지역의 좋고 나쁨을 의미하지 않습니다.',
    missingNote: '결측 지역은 순위에서 제외하고 별도로 표시합니다.',
  },
  trend: {
    title: '시계열',
    nationwide: '전국 추세',
    selectedRegions: '선택 지역 추세',
    countAxis: '학생 수(명)',
    rateAxis: '비율(%)',
    missingSegment: '결측 구간은 선을 연결하지 않습니다.',
    coverageNote: '시도별 자료는 2020~2025년, 전국 학교급별 자료는 2016~2025년을 제공합니다.',
    maxRegionsNote: '최대 3개 지역까지 비교할 수 있습니다.',
  },
  regionDetail: {
    title: '지역 상세',
    currentCount: '최신 학생 수',
    currentRate: '최신 비율',
    nationwideDifference: '전국 값과의 차이',
    nationwideRank: '전국 순위',
    schoolLevelComposition: '학교급별 구성',
    yearChange: '전년 대비 변화',
    studentTypeUnavailable:
      '이 통계는 학생 유형별(국내출생·중도입국·외국인가정) 구분을 제공하지 않습니다.',
    selectPrompt: '지역을 선택하면 상세 정보가 표시됩니다.',
  },
  sources: {
    title: '출처 및 계산식',
    tableName: '통계표명',
    tableNameValue: '시도별 다문화학생 수 및 다문화학생 비율',
    tableId: '통계표 ID',
    numeratorTableId: 'F008403 (분자)',
    denominatorTableId: 'DT_1963003_002·003·004·009 (분모)',
    organization: '작성기관',
    organizationValue: '교육부·한국교육개발원 「교육기본통계」',
    provider: '제공처',
    numeratorProvider: 'e-나라지표 (분자)',
    denominatorProvider: 'KOSIS 국가통계포털 OpenAPI (분모)',
    originalLinks: '원자료 링크',
    numeratorLink: 'e-나라지표 원자료',
    denominatorLink: 'KOSIS 원자료',
    numeratorUrl: 'https://www.index.go.kr/unify/idx-info.do?idxCd=F0084',
    denominatorUrl: 'https://kosis.kr/',
    updatedAt: '갱신일',
    referenceDate: '기준일',
    provisional: '잠정치 여부',
    unknown: '미확인',
    processed: '가공 여부',
    computedRate: '비율은 직접 계산',
    formula: '계산식',
    formulaValue: '다문화학생 수 ÷ (초+중+고+각종 학생수) × 100',
    notes: '주석',
    ratePrecisionNote: '2025년 공표 비율은 정수로 반올림되어 있어 표시에는 계산값을 사용합니다.',
    schoolLevelNote:
      '분모는 초등학교·중학교·고등학교·각종학교 학생수이며, 유치원·특수학교는 제외합니다.',
    sourceStatusNote: '기준일과 잠정치 여부는 원자료에서 확인되지 않았습니다.',
  },
  download: {
    title: '다운로드',
    currentFilterCsv: '현재 필터 결과 CSV',
    fullCsv: '전체 정규화 데이터 CSV',
    fullJson: '전체 정규화 데이터 JSON',
    dictionary: '데이터 사전 Markdown',
    utf8BomNote: 'CSV는 Excel에서 한글이 깨지지 않도록 UTF-8 BOM을 포함합니다.',
    provenanceNote: '다운로드 파일에는 출처·기준 연도·계산식 주석이 포함됩니다.',
  },
  missing: {
    value: '—',
    label: '데이터 없음',
    ariaLabel: '데이터 없음',
    sourceMissing: '원자료에 값이 없습니다(0명이 아님).',
    noResults: '선택한 조건에 해당하는 데이터가 없습니다.',
    resetFilters: '필터 초기화',
    rateUnavailable: '분자 또는 분모 결측으로 비율을 계산할 수 없습니다.',
  },
  ethics: {
    termTitle: '다문화학생이란?',
    definition:
      '교육부·한국교육개발원 「교육기본통계」의 공식 분류로, 국제결혼가정 자녀(국내출생·중도입국)와 외국인가정 자녀를 포함합니다.',
    limitation:
      '이 분류는 행정 통계를 위한 범주이며, 학생 개개인의 정체성·언어능력·문화적 배경을 설명하지 않습니다. 같은 범주 안에도 매우 다양한 경험이 존재합니다.',
    perspective:
      '이 지표는 지원이 필요한 대상의 규모가 아니라, 여러 언어와 문화를 지닌 학생이 우리 교육에 얼마나 함께하고 있는지를 보여줍니다.',
    ranking: '순위는 교육의 우열을 나타내지 않습니다.',
    categoryLimitation: '행정 범주는 개인의 정체성이나 경험 전체를 설명하지 않습니다.',
    aggregateOnly: '이 플랫폼은 개인을 식별할 수 없는 시도 단위 집계 통계만 다룹니다.',
    noCausalInterpretation: '수치의 차이를 정책 효과나 인과관계로 해석하지 않습니다.',
  },
  errors: {
    generic: '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    dataLoad: '데이터를 불러오지 못했습니다.',
    invalidFilter: '선택한 필터 값이 올바르지 않습니다.',
    tooManyRegions: '지역은 최대 3개까지 선택할 수 있습니다.',
    routeNotFound: '요청한 화면을 찾을 수 없습니다.',
  },
} as const;

type ContentLeafPaths<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Readonly<Record<string, unknown>>
      ? `${Key}.${ContentLeafPaths<T[Key]>}`
      : never;
}[keyof T & string];

export type ContentKey = ContentLeafPaths<typeof ko>;
export type KoreanContent = typeof ko;

export default ko;
