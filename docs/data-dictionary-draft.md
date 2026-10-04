# K-MOSAIC 데이터 사전 (초안)

> **상태**: 초안 v1 — 실제 취득 데이터에 기반해 작성됨
> **근거**: [data-audit.md](./data-audit.md)
> **실물**: `data/snapshots/multicultural-students.v1.json` (540 레코드)

---

## 1. 설계 원칙

1. **원자료의 공식 분류명을 보존한다.** 정규화 값과 원본 표기를 함께 저장한다.
2. **결측과 0을 구분한다.** 값이 없으면 `null`이며 `0`으로 대체하지 않는다.
3. **가공값은 원자료와 구분한다.** 계산된 비율과 공표 비율을 별도 필드로 둔다.
4. **조인 키는 코드다.** 지역명은 시계열 중간에 바뀌므로 표시용으로만 쓴다.
5. **모든 레코드가 출처를 안다.** 통계표 ID·취득시각·계산식을 포함한다.
6. **영문명은 임의 확정하지 않는다.** 매핑표로 관리하고 공식 영문 표기가 확인되면 교체한다.

---

## 2. 핵심 타입

```ts
/** 행정표준코드 시도 2자리. 세종(36) 포함 17개. */
export type RegionCode =
  | '11' | '26' | '27' | '28' | '29' | '30' | '31' | '36'
  | '41' | '42' | '43' | '44' | '45' | '46' | '47' | '48' | '50';

/** 전국 집계를 포함한 지역 식별자. */
export type RegionScope = RegionCode | 'KR';

/**
 * 학교급.
 * 출처(e-나라지표 F0084)가 제공하는 범위에 정확히 맞춘다.
 * 유치원·특수학교는 이 통계의 모수에 포함되지 않으므로 타입에 두지 않는다.
 *   (data-audit.md §5 역검증으로 확인)
 */
export type SchoolLevel =
  | 'all'         // 초+중+고+각종학교 합계
  | 'elementary'  // 초등학교
  | 'middle'      // 중학교
  | 'high'        // 고등학교
  | 'other';      // 각종학교

/**
 * 학생 유형.
 * ⚠️ 현재 확보한 출처는 유형별 구분을 제공하지 않는다 (data-audit.md §7).
 *    MVP에서는 'total' 만 사용한다. 나머지는 Phase 2를 위한 예약값이다.
 */
export type MulticulturalStudentType =
  | 'total'
  | 'domesticBorn'   // 국제결혼가정 자녀 (국내출생)  — 미제공
  | 'midEntry'       // 국제결혼가정 자녀 (중도입국)  — 미제공
  | 'foreignFamily'  // 외국인가정 자녀              — 미제공
  | 'unknown';
```

---

## 3. 레코드 스키마

```ts
export interface MulticulturalStudentStat {
  // --- 차원 (복합 키: year + regionCode + schoolLevel + studentType) ---
  year: number;                       // 조사 연도 (서기)
  regionCode: RegionScope;
  regionNameKo: string;               // 표시용. 해당 연도의 공식 표기
  regionNameEn: string;               // 매핑표 기반. 공식 영문 표기 확인 시 교체
  schoolLevel: SchoolLevel;
  studentType: MulticulturalStudentType;

  // --- 측정값 ---
  /** 다문화학생 수(명). null = 결측(원자료 '-'). 0명이 아님. */
  multiculturalStudentCount: number | null;
  /** 전체 학생 수(명) = 분모. null = 분모 구성 학교급 중 결측 존재. */
  totalStudentCount: number | null;
  /** 직접 계산한 비율(%). 화면 표시는 이 값을 쓴다. */
  multiculturalStudentRateComputed: number | null;
  /** 출처가 공표한 비율(%). 대조용. 2025년은 정수 반올림되어 있음. */
  multiculturalStudentRatePublished: number | null;

  // --- 계보 ---
  notes: string[];                    // 결측·정밀도 등 주의사항
}
```

### 3.1 필드별 상세

| 필드 | 타입 | 필수 | 설명 | 함정 |
|---|---|---|---|---|
| `year` | number | ✅ | 2020~2025 (시도별), 2016~2025 (전국 학교급별) | 조사 기준일은 매년 4월 1일 ([data-audit §10.2](data-audit.md)) |
| `regionCode` | RegionScope | ✅ | `'KR'`은 전국 집계 | KOSIS 자체 코드(`07a`)와 다름 |
| `regionNameKo` | string | ✅ | 강원특별자치도(2023~), 전북특별자치도(2024~) | **시계열 중 변경됨** |
| `regionNameEn` | string | ✅ | 잠정 매핑 | 공식 영문 표기 미확인 |
| `schoolLevel` | SchoolLevel | ✅ | | `other`(각종학교)는 모수가 작아 비율 왜곡 |
| `studentType` | 위 타입 | ✅ | MVP는 `'total'` 고정 | |
| `multiculturalStudentCount` | number\|null | ✅ | 명 | **`null` ≠ `0`** |
| `totalStudentCount` | number\|null | ✅ | 명 | KOSIS 4개 표 합산 |
| `multiculturalStudentRateComputed` | number\|null | ✅ | %, 소수 4자리 | |
| `multiculturalStudentRatePublished` | number\|null | ✅ | % | **2025년 정수 반올림** |
| `notes` | string[] | ✅ | | 빈 배열 허용 |

---

## 4. 비율 계산식

```
multiculturalStudentRateComputed
  = multiculturalStudentCount / totalStudentCount × 100

totalStudentCount
  = 초등학교 학생수 + 중학교 학생수 + 고등학교 학생수 + 각종학교 학생수
    (유치원·특수학교 제외)
```

**분모 근거**: 후보 조합별 역검증 결과 이 조합이 공표 비율과 ±0.05%p 이내 100% 일치 ([data-audit.md §5](./data-audit.md)). 특수학교를 포함하면 81.3%로 하락한다.

**소수 처리**: 계산은 소수 4자리까지 보존하고, 화면 표시에서 1자리로 반올림한다. 저장 단계에서 반올림하지 않는다.

**결측 전파**: 분자 또는 분모 구성요소 중 하나라도 `null`이면 비율도 `null`이다. 부분 합산으로 비율을 만들지 않는다.

---

## 5. 지역 매핑표

| regionCode | 약칭 (e-나라지표) | 공식명 (KOSIS) | KOSIS 자체 C1 | 영문(잠정) |
|---|---|---|---|---|
| 11 | 서울 | 서울특별시 | 01 | Seoul |
| 26 | 부산 | 부산광역시 | 02 | Busan |
| 27 | 대구 | 대구광역시 | 03 | Daegu |
| 28 | 인천 | 인천광역시 | 04 | Incheon |
| 29 | 광주 | 광주광역시 | 05 | Gwangju |
| 30 | 대전 | 대전광역시 | 06 | Daejeon |
| 31 | 울산 | 울산광역시 | 07 | Ulsan |
| **36** | 세종 | 세종특별자치시 | **07a** | Sejong |
| 41 | 경기 | 경기도 | 08 | Gyeonggi |
| 42 | 강원 | 강원특별자치도 | 09 | Gangwon |
| 43 | 충북 | 충청북도 | 10 | Chungbuk |
| 44 | 충남 | 충청남도 | 11 | Chungnam |
| 45 | 전북 | 전북특별자치도 | 12 | Jeonbuk |
| 46 | 전남 | 전라남도 | 13 | Jeonnam |
| 47 | 경북 | 경상북도 | 14 | Gyeongbuk |
| 48 | 경남 | 경상남도 | 15 | Gyeongnam |
| 50 | 제주 | 제주특별자치도 | 16 | Jeju |

**개칭 이력** (조인 시 반드시 흡수)
- `강원도` → `강원특별자치도` (2023)
- `전라북도` → `전북특별자치도` (2024)

구현: `scripts/probe/regions.mjs`

---

## 6. 출처 메타

```ts
export interface SourceRef {
  role: 'numerator' | 'denominator';
  provider: string;          // 'e-나라지표' | 'KOSIS OpenAPI'
  organization: string;      // 원자료 작성기관
  statisticsName: string;    // '교육기본통계'
  tableId: string;           // 'F008403' | 'DT_1963003_002'
  tableName: string;
  accessMethod: 'html-parse' | 'openapi';
  sourceUrl: string;
  retrievedAt: string;       // ISO 8601
  lastChangedAt: string | null; // 출처가 밝힌 자료수정일 (KOSIS LST_CHN_DE)
  referenceDate: string | null; // 조사 기준일 — 최신 수록연도의 YYYY-04-01
  isProvisional: boolean | null; // 잠정치 여부 — 출처가 구분을 제공하지 않아 null
}
```

| 역할 | 제공처 | 통계표 | 접근 |
|---|---|---|---|
| 분자 | e-나라지표 F0084 | `F008403` 시도별 다문화학생 수 및 비율 | HTML 파싱 |
| 분모 | KOSIS OpenAPI | `DT_1963003_002` 초등학교 개황 | OpenAPI |
| 분모 | KOSIS OpenAPI | `DT_1963003_003` 중학교 개황 | OpenAPI |
| 분모 | KOSIS OpenAPI | `DT_1963003_004` 고등학교 개황 | OpenAPI |
| 분모 | KOSIS OpenAPI | `DT_1963003_009` 각종학교 개황 | OpenAPI |

> `referenceDate`는 교육기본통계 조사 기준일(매년 4월 1일)로 확정되어([data-audit §10.2](data-audit.md)) 최신 수록연도의 `YYYY-04-01`을 넣는다. `isProvisional`은 출처가 구분을 제공하지 않아 `null`로 두고 UI에서 "미확인"으로 표시한다 — 임의의 값을 넣지 않는다.

---

## 7. 결측·주석 코드

| `notes` 값 | 의미 | UI 처리 |
|---|---|---|
| `원자료 결측(-) — 0명이 아님` | 출처가 `-`로 표기 | 지도: 사선 패턴 / 표: `—` |
| `분모 일부 학교급 결측 — 비율 계산 불가` | 분모 구성 중 결측 | 비율 셀 비움 |
| `공표 비율이 정수 반올림됨 — 표시에는 계산값을 사용` | 2025년 | 출처 패널에 주석 표시 |

---

## 8. 파생 지표 (앱 계산)

원본 스냅숏에 저장하지 않고 앱에서 계산한다. 계산식은 화면에 명시한다.

| 지표 | 계산식 | 주의 |
|---|---|---|
| 전년 대비 증감 인원 | `count[y] - count[y-1]` | 어느 한쪽 `null`이면 `null` |
| 전년 대비 증가율 | `(count[y]/count[y-1] - 1) × 100` | 분모 0 또는 `null` 방지 |
| 전국 값과의 차이 | `rate[region] - rate['KR']` | "평균"이 아니라 **전국 집계 비율**임을 명시 |
| 지역 순위 | 값 내림차순 | 동률 처리 규칙은 PRD §4 참조 |

> ⚠️ `rate['KR']`은 17개 시도 비율의 산술평균이 **아니라** 전국 합계 기반 비율이다. UI에서 "전국 평균"이라는 표현을 쓰지 않고 **"전국 값"**으로 표기한다.

---

## 9. 검증 규칙 (수집 파이프라인)

| # | 규칙 | 실패 시 |
|---|---|---|
| V1 | 17개 시도가 모두 존재 | 배포 차단 |
| V2 | 시도 합계 = 전국 값 (허용오차 0) | 배포 차단 |
| V3 | `schoolLevel='all'` = 초+중+고+각종 합 | 배포 차단 |
| V4 | 계산 비율 vs 공표 비율 오차 ≤ 0.1%p (2024년 이전) | 배포 차단 |
| V5 | 결측이 `0`으로 변환되지 않음 | 배포 차단 |
| V6 | 모든 레코드에 출처 메타 존재 | 배포 차단 |
| V7 | 스냅숏 재실행 시 `retrievedAt` 외 diff 없음 (멱등) | 경고 |
| V8 | 연도 커버리지가 이전 스냅숏보다 줄지 않음 | 경고 |
