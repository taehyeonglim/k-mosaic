# K-MOSAIC 아키텍처

> **결정 근거**: [ADR-001 데이터 수집](./adr/001-data-ingestion-architecture.md) · [ADR-002 지도](./adr/002-map-library.md) · [ADR-003 차트](./adr/003-chart-library.md)
> **데이터 현실**: [data-audit.md](./data-audit.md)

---

## 1. 전체 구조

K-MOSAIC은 **수집 파이프라인**과 **웹 애플리케이션**이 완전히 분리된 2계층 구조다. 둘은 코드가 아니라 **정규화 스냅숏 파일**로만 결합한다.

```
┌─ 오프라인 (개발자 로컬 / CI, 연 1회 실행) ────────────────────┐
│                                                              │
│  e-나라지표 F008403 ──HTML 파서──┐                            │
│    (분자: 다문화학생 수)          │                            │
│                                  ├─→ 정규화 ─→ 검증 ─→ 스냅숏 │
│  KOSIS OpenAPI ─────API 클라이언트┘              │            │
│    (분모: 전체 학생 수)                     실패 시 중단       │
│    ↑ KOSIS_API_KEY 는 여기서만 존재                          │
└──────────────────────────────────┬───────────────────────────┘
                                   │ data/snapshots/*.json (git 커밋)
┌──────────────────────────────────▼───────────────────────────┐
│  웹 애플리케이션 (정적 빌드)                                   │
│    스냅숏 로드 → 지도 · 필터 · 순위 · 추세 · 출처 · 다운로드    │
│    ✓ API 키 없음  ✓ 서버 런타임 없음  ✓ 외부 호출 없음         │
└──────────────────────────────────────────────────────────────┘
```

**핵심 성질**: 배포 산출물에 비밀정보가 **존재할 수 없다**. 키는 수집 단계에만 쓰이고 결과물에 남지 않는다.

---

## 2. 디렉터리 구조

```
k-mosaic/
├── data/
│   ├── raw/           # 원본 응답 (gitignore — 재현 가능)
│   ├── normalized/    # 정규화 중간 산출물
│   ├── snapshots/     # ✅ 커밋: 검증된 배포용 데이터
│   └── metadata/      # ✅ 커밋: 출처·계보·데이터 사전
├── scripts/
│   ├── probe/         # 탐색 프로토타입 (기획 단계 산출물)
│   │   ├── regions.mjs
│   │   ├── verify-denominator.mjs
│   │   └── build-snapshot.mjs
│   ├── inspect-mcp.ts        # MCP 도구·스키마 점검
│   ├── discover-tables.ts    # 통계표 탐색·목록화
│   ├── fetch-multicultural-stats.ts  # 분자 수집 (e-나라지표)
│   ├── fetch-total-students.ts       # 분모 수집 (KOSIS)
│   ├── normalize-stats.ts            # 정규화
│   ├── validate-stats.ts             # 검증 게이트
│   └── build-public-dataset.ts       # 공개 데이터 생성
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/
│   ├── lib/
│   │   ├── schema/    # Zod 스키마 (단일 진실 원천)
│   │   ├── data/      # 스냅숏 로더·셀렉터
│   │   └── viz/       # 색상·척도 (지도·차트 공유)
│   └── content/       # UI 문자열 (i18n 대비)
├── public/geo/        # 시도 경계 GeoJSON
└── docs/
```

---

## 3. 수집 파이프라인

### 3.1 단계

| 단계 | 스크립트 | 입력 | 출력 | 실패 시 |
|---|---|---|---|---|
| 1 | `fetch-multicultural-stats` | e-나라지표 HTML | `data/raw/enara-*.html` + 파싱 JSON | 중단 |
| 2 | `fetch-total-students` | KOSIS OpenAPI | `data/raw/kosis-*.json` | 중단 |
| 3 | `normalize-stats` | raw | `data/normalized/*.json` | 중단 |
| 4 | `validate-stats` | normalized | 검증 리포트 | **스냅숏 갱신 안 함** |
| 5 | `build-public-dataset` | normalized | `data/snapshots/*.json`, CSV | 중단 |

**모든 단계는 멱등하다.** 같은 입력이면 `retrievedAt` 외에 diff가 없어야 한다.

### 3.2 검증 게이트가 핵심이다

```
정규화 → [검증] → 스냅숏
            │
            └─ 실패 → 기존 스냅숏 유지 + 배포 차단
```

**오염된 새 데이터보다 검증된 옛 데이터가 낫다.** e-나라지표 페이지 구조가 바뀌면 파서가 조용히 잘못된 값을 뽑을 수 있는데, 검증 게이트가 이를 배포 전에 잡는다.

검증 규칙은 [data-dictionary-draft.md §9](./data-dictionary-draft.md) V1~V8.

### 3.3 파서 취약성 대응

HTML 파싱은 구조 변경에 취약하다. 3중 방어:

1. **구조 단언** — 표 첫 행이 연도, 둘째 행 첫 값이 `전국`인지 확인. 아니면 즉시 실패
2. **셀 수 검증** — `연도수 × 지역수`와 일치하지 않으면 실패
3. **회귀 테스트** — 저장된 HTML 픽스처로 파서 단위 테스트. 실제 네트워크 없이 CI에서 검증

> 파서는 **조용히 틀리기보다 시끄럽게 실패**해야 한다.

### 3.4 KOSIS 호출 규율

| 제약 | 대응 |
|---|---|
| **200건/분** (실측, 문서의 1,000건/분과 다름) | 호출 간 400ms 지연, 순차 실행 |
| 40,000셀/회 | 연도 범위로 분할 |
| 표마다 분류축 개수 상이 | 메타 조회 후 `objL*` 구성. `_S` 표에 `objL3` 금지 |
| HTTPS 전용 | |

---

## 4. 웹 애플리케이션

### 4.1 기술 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | **Next.js (App Router)** | 정적 내보내기 지원, 서버 컴포넌트로 스냅숏을 빌드 타임에 주입, Phase 2에서 서버 라우트 승격 가능 |
| 언어 | **TypeScript** (strict) | 결측(`null`) 처리를 타입으로 강제 |
| 스타일 | **Tailwind CSS** | 토큰 기반 설계와 잘 맞음 |
| 검증 | **Zod** | 스냅숏 스키마의 단일 진실 원천. 타입 추론 + 런타임 검증 |
| 지도 | **d3-geo + SVG 직접** | ADR-002 |
| 차트 | **Recharts** | ADR-003 |
| 색상·척도 | **d3-scale, d3-scale-chromatic** | 지도·차트 공유 |
| 테스트 | **Vitest** + **Playwright** | testing-strategy.md |
| 패키지 | **pnpm** | |
| 런타임 | **Node.js ≥ 20** | |

> Next.js를 쓰되 **MVP는 정적 내보내기**한다. 서버 런타임을 켜지 않는 것이 ADR-001의 보안 이점을 유지하는 방법이다.

### 4.2 데이터 흐름

```
data/snapshots/*.json
   │ 빌드 타임 import
   ▼
Zod 파싱 (실패 시 빌드 실패)
   │
   ▼
인덱싱 — Map<`${year}|${regionCode}|${schoolLevel}`, Record>
   │
   ▼
셀렉터 (순수 함수)
   ├─ selectNational(year)
   ├─ selectByRegion(year, level)
   ├─ selectRanking(year, level, metric)
   ├─ selectTrend(regionCodes[], level, metric)
   └─ selectRegionDetail(regionCode, year)
   │
   ▼
React 컴포넌트 (표시 전담)
```

**셀렉터는 순수 함수**다. 입력이 같으면 출력이 같고, 부수효과가 없다. 단위 테스트가 쉽고 UI와 독립적으로 정확성을 검증할 수 있다.

### 4.3 상태 관리

필터 상태(연도·학교급·지표·선택 지역)는 **URL 쿼리스트링**에 둔다.

```
/?year=2025&level=all&metric=rate&regions=41,11,46
```

이유:
- 특정 화면을 그대로 공유·인용할 수 있다 (연구·정책 활용의 핵심)
- 뒤로가기가 자연스럽게 동작
- 전역 상태 라이브러리 불필요

### 4.4 컴포넌트 경계

각 단위는 하나의 책임을 갖고 인터페이스로만 소통한다.

| 컴포넌트 | 책임 | 의존 |
|---|---|---|
| `NationalOverview` | 전국 핵심 지표 카드 | 셀렉터 |
| `ChoroplethMap` | 17개 시도 SVG 렌더 + 선택 | GeoJSON, 색상 스케일 |
| `MapLegend` | 범례 (결측 패턴 포함) | 색상 스케일 |
| `FilterBar` | 필터 UI ↔ URL 동기화 | — |
| `RankingTable` | 순위 표 (지도 대체 표현 겸함) | 셀렉터 |
| `TrendChart` | 시계열 (최대 3개 지역) | 셀렉터 |
| `RegionDetailPanel` | 선택 지역 상세 | 셀렉터 |
| `SourcePanel` | 출처·계산식·주석 | 메타 |
| `DownloadButtons` | CSV/JSON 내보내기 | 셀렉터 |

`ChoroplethMap`은 데이터를 **모른다** — `{ regionCode, value, isMissing }[]`와 색상 함수만 받는다. 덕분에 학생 수/비율 전환이 지도 내부 변경 없이 이뤄진다.

---

## 5. 보안 설계

### 5.1 위협 모델

핵심 위협은 **`KOSIS_API_KEY` 유출** 하나다. 개인정보는 다루지 않는다(집계 통계만).

### 5.2 통제

| # | 통제 | 구현 |
|---|---|---|
| S1 | 키는 `.env.local`에만. `.gitignore` 최상단 규칙 | ✅ 적용됨 (`.env.*`, `!.env.example`) |
| S2 | `NEXT_PUBLIC_` 접두사 비밀키 금지 | 린트 규칙 + CI 검사 |
| S3 | **런타임에 키 부재** — 정적 배포이므로 구조적으로 불가능 | ADR-001 |
| S4 | 로그에 URL 전문 출력 금지 (KOSIS는 쿼리스트링 인증) | `redact()` 유틸 강제 |
| S5 | 에러 메시지에서 키 마스킹 | `redact()` 적용 |
| S6 | 테스트 픽스처에 실제 키 사용 금지 | 픽스처는 응답 본문만 저장 |
| S7 | 커밋 전 비밀정보 스캔 | pre-commit 훅 + CI |
| S8 | 소스맵·번들에 비밀 없음 | 빌드 산출물 **바이트 단위** 검사 (§5.5) |
| S9 | **빌드 캐시에 키 유입 차단** | `build` 스크립트가 `KOSIS_API_KEY=` 로 실행 (§5.5) |

### 5.5 실측으로 발견한 두 가지 함정

구현 중 실제로 확인된 사항이며, 둘 다 "검사했는데 놓치는" 유형이다.

**① Next.js 빌드 캐시로의 키 유입**

Next.js는 `.env.local`을 **자동으로** `process.env`에 로드하고, turbopack은 캐시 무효화를 위해 환경 스냅숏을 `.next/cache/turbopack/*.sst`에 직렬화한다. 그 결과 **앱 코드가 키를 참조하지 않아도** 키가 빌드 캐시에 평문으로 남는다.

배포 산출물(`out/`)은 영향이 없으나, CI가 `.next/`를 캐시·업로드하면 유출 경로가 된다.

대응 — `build` 스크립트를 다음으로 고정한다.

```json
"build": "KOSIS_API_KEY= next build"
```

`@next/env`는 **이미 정의된 환경변수를 덮어쓰지 않는다**(dotenv 의미론). 빈 값으로 선점하면 `.env.local`의 값이 로드되지 않는다. 웹 앱은 이 키를 사용하지 않으므로 부작용이 없고, `scripts/`는 여전히 `.env.local`에서 직접 읽는다.

**② `grep`으로 하는 비밀정보 검사는 신뢰할 수 없다**

이 환경의 `grep`은 실제로 **ugrep**이며 바이너리 파일 처리 의미론이 GNU grep과 다르다. `.sst` 캐시에 키가 실재하는데도 `grep -F`가 검출하지 못했다.

대응 — 비밀정보 검사는 **바이트 단위 비교**로 한다.

```
Buffer.includes(Buffer.from(secret, 'utf8'))
```

`scripts/security/scan-secrets.ts`가 이 방식을 쓴다. 검사 도구 자체를 신뢰하기 전에 **알려진 양성 사례로 도구를 검증**하라.

### 5.3 `redact()` 패턴

```ts
// 이 함수를 거치지 않은 문자열은 로그·에러에 넣지 않는다.
export const redact = (s: unknown) =>
  String(s).split(process.env.KOSIS_API_KEY ?? '\0').join('***REDACTED***');
```

`scripts/probe/verify-denominator.mjs`에 이미 적용되어 있다.

### 5.4 키 회전

키가 노출되었을 가능성이 있으면 [KOSIS OpenAPI 관리](https://kosis.kr/openapi/)에서 재발급한다. 정적 배포이므로 **재발급이 서비스에 영향을 주지 않는다** — 다음 수집 시점에만 필요하다.

---

## 6. 배포

| 항목 | 선택 |
|---|---|
| 방식 | 정적 사이트 (Next.js `output: 'export'`) |
| 후보 | Vercel / Cloudflare Pages / GitHub Pages |
| 환경변수 | **런타임 없음**. CI 시크릿에만 `KOSIS_API_KEY` |
| 캐시 | 스냅숏은 파일명에 버전 포함 → 불변 캐싱 |
| 데이터 갱신 | 수집 스크립트 실행 → 검증 통과 → 커밋 → 재배포 |

### 장애 시나리오

| 상황 | 영향 | 대응 |
|---|---|---|
| KOSIS 장애 | **서비스 무영향** | 다음 수집 때 재시도 |
| e-나라지표 구조 변경 | 서비스 무영향, 갱신 실패 | 검증 게이트가 차단 → 파서 수정 |
| MCP 서버 중단 | **서비스 무영향** | 런타임 의존 없음 |

---

## 7. Phase 2 승격 경로

수집 계층이 웹 앱과 스키마로만 결합되어 있으므로, 아래는 **웹 앱 수정 없이** 가능하다.

- 관리자 갱신 트리거 → 수집 스크립트를 서버 라우트로 감싼다
- 시·군·구 상세 조회 → 서버 라우트가 MCP를 호출해 동일 스키마로 반환
- OpenAPI 제공 → 스냅숏을 그대로 서빙

AI 기능을 추가할 경우 **출처 기반 수치와 AI 추론을 화면에서 구조적으로 분리**한다 (브리프 §8, §11). AI 응답은 별도 영역·별도 배지로 표시하고 공식 통계와 같은 시각적 위계를 부여하지 않는다.
