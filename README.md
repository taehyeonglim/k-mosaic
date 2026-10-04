# K-MOSAIC

**Korea Multicultural Student Data Explorer**
대한민국 다문화학생 교육통계 시각화·분석 플랫폼

---

## 1. 프로젝트 소개

대한민국 17개 시·도(세종 포함)의 다문화학생 통계를 지도·순위·시계열로 탐색하는 웹 플랫폼입니다.

이 프로젝트의 차별점은 **모든 화면에서 숫자의 출처·통계표 ID·계산식·한계에 도달할 수 있다**는 점입니다. 통계를 보여주는 데 그치지 않고, 그 통계를 어디까지 믿을 수 있는지도 함께 보여줍니다.

| 항목 | 값 |
|---|---|
| 수록 연도 | 2020~2025 (시도별 · 전국 학교급별) |
| 지역 | 전국 + 17개 시·도 |
| 학교급 | 초등학교 · 중학교 · 고등학교 · 각종학교 |
| 레코드 | 540 |
| 2025년 전국 | 202,208명 (전체 학생의 4.0%) |

---

## 2. 주요 기능

- **전국 개요** — 학생 수, 비율, 전년 대비, 최초 연도 대비
- **17개 시·도 단계구분도** — 학생 수/비율 전환, 키보드 조작, 결측 사선 패턴, 표 대체 표현
- **필터** — 연도 · 학교급 · 지표 · 지역(최대 3개). 상태가 URL에 반영되어 화면 공유 가능
- **지역 순위 4종** — 학생 수, 비율, 절대 증가, 증가율. 동률은 공동 순위, 결측은 제외 후 별도 표기
- **지역 상세** — 순위, 전국 값과의 차이, 학교급별 구성, 추세
- **시계열** — 전국/지역 추세, 최대 3개 비교, 결측 구간 단절
- **출처 및 방법론** — 통계표 ID, 작성기관, 계산식, 결측·잠정치 처리
- **다운로드** — 필터 결과 CSV, 전체 CSV/JSON, 데이터 사전
- **대학 외국인 유학생** (`/foreign-students`) — 아래 참조

### 대학 외국인 유학생 페이지

`/foreign-students`에서 **고등교육기관(대학) 외국인 학생 비율**을 별도로 제공합니다.

> ⚠️ **메인 화면의 다문화학생과 서로 다른 학생 집단입니다.**
> 다문화학생 = **초·중등**(각종학교 포함) · 외국인 학생 = **고등교육기관 재적**
> 두 수치를 직접 비교하지 마십시오. ([DL-008](docs/decision-log.md))

| 항목 | 값 |
|---|---|
| 2025년 외국인 학생수 | 202,852명 (전체 재적 대비 **7.0%**) |
| 전체 재적학생 | 2,903,195명 |
| 시도별 수록 | 2022~2025 (KOSIS `DT_1963003_010_S`) |
| 전국 장기 시계열 | 2018~2025 (e-나라지표 `1534`) |

계산식: `외국인 학생수(학위과정) ÷ 재적 학생수 × 100`

> 📌 출처에서 **2023년 값이 2022년과 동일하게 제공**됩니다. 실제 변화가 없었다는 뜻이 아니라 확인이 필요한 사항이며, 화면에 주석으로 표시됩니다. 검증 규칙 `X12`가 이를 자동 탐지합니다. ([DL-009](docs/decision-log.md))

---

## 3. 기술 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | Next.js 16 App Router (`output: 'export'`) | 정적 배포, 런타임 비밀 없음 |
| 언어 | TypeScript strict | 결측(`null`) 처리를 타입으로 강제 |
| 스타일 | Tailwind CSS v4 | |
| 검증 | Zod | 스냅숏 스키마의 단일 진실 원천 |
| 지도 | d3-geo + SVG 직접 렌더링 | 접근성 — [ADR-002](docs/adr/002-map-library.md) |
| 차트 | Recharts | SVG·SSR — [ADR-003](docs/adr/003-chart-library.md) |
| 테스트 | Vitest · Playwright | |
| 패키지 | pnpm · Node ≥ 20 | |

---

## 4. 로컬 실행

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

> 웹 앱은 커밋된 스냅숏만 읽습니다. **개발에 API 키가 필요 없습니다.**

---

## 5. 운영 — 데이터 갱신 · 배포 · 보안

운영 절차는 [docs/operations.md](docs/operations.md)에 있습니다.

| 작업 | 명령 | API 키 |
|---|---|---|
| 연례 데이터 갱신 | `pnpm data:refresh` | ✅ 필요 (`.env.local`) |
| 검증 게이트 | `pnpm data:validate` · `pnpm data:validate-foreign` | ❌ |
| 새 연도 공표 확인 | `pnpm data:check-upstream` (GitHub Actions가 주기 실행) | ❌ |
| 정적 빌드 | `pnpm build` → `out/` | ❌ |

**검증에 실패하면 스냅숏을 갱신하지 않습니다.** 오염된 새 데이터보다 검증된 옛 데이터가 낫기 때문입니다. `main`에 머지하면 GitHub Pages로 자동 배포됩니다.


## 6. 테스트

```bash
pnpm typecheck
pnpm lint
pnpm check:imports        # src/ 의 .js 확장자 import 검사 (typecheck 에 포함됨)
pnpm test                 # 단위·통합 (Vitest) — 39개
pnpm test:e2e             # E2E·접근성 (Playwright) — 32개
```

포트 3000이 사용 중이면:

```bash
PLAYWRIGHT_PORT=4180 pnpm test:e2e
```

E2E 산출물: `e2e/screenshots/`, `e2e/playwright-report/`, [`docs/qa-report.md`](docs/qa-report.md)

---

## 7. 데이터 출처

| 역할 | 출처 | 통계표 |
|---|---|---|
| 다문화학생 수 | [e-나라지표 F0084](https://www.index.go.kr/unify/idx-info.do?idxCd=F0084) | `F008403` |
| 전체 학생 수 | [KOSIS](https://kosis.kr) 교육기본통계 | `DT_1963003_002·003·004·009` |
| 원자료 작성 | 교육부·한국교육개발원 「교육기본통계」 | |
| 행정경계 | 통계청 SGIS — 공공누리 제1유형 (가공: [vuski/admdongkor](https://github.com/vuski/admdongkor), CC BY 4.0) | [docs/geo-source.md](docs/geo-source.md) |

**비율 계산식**

```
다문화학생 비율 = 다문화학생 수 ÷ (초 + 중 + 고 + 각종학교 학생수) × 100
```

모수는 후보 조합별 역검증으로 확정했습니다 — 이 조합만 공표치와 ±0.05%p 이내 100% 일치합니다 (특수학교 포함 시 81.3%로 하락). 2022년 전국 168,645명이 한국교육개발원 공표치와 정확히 일치합니다.

---

## 8. 통계 해석상 유의사항

**"다문화학생"** 은 교육부·한국교육개발원 「교육기본통계」의 공식 분류로, 국제결혼가정 자녀(국내출생·중도입국)와 외국인가정 자녀를 포함합니다.

이 분류는 **행정 통계를 위한 범주**이며 학생 개개인의 정체성·언어능력·문화적 배경을 설명하지 않습니다. 같은 범주 안에도 매우 다양한 경험이 존재합니다.

이 지표는 지원이 필요한 대상의 규모가 아니라, **여러 언어와 문화를 지닌 학생이 우리 교육에 얼마나 함께하고 있는지**를 보여줍니다.

- 다문화학생 비율이 높다는 것이 문제나 위험을 뜻하지 않습니다
- 지역 간 순위는 교육의 우열을 의미하지 않습니다
- 데이터가 없는 지역은 `0명`이 아니라 **"데이터 없음"** 입니다
- **"전국 값"은 17개 시·도 비율의 산술평균이 아니라** 전국 합계 기반 비율입니다

### 알려진 한계

| 항목 | 상태 |
|---|---|
| 학생 유형별(국내출생/중도입국/외국인가정) | ❌ 출처가 제공하지 않음 ([DL-001](docs/decision-log.md)) |
| 시·군·구 단위 | ❌ 시도가 최소 단위 |
| 유치원·특수학교 | ❌ 이 통계의 모수에 없음 ([DL-004](docs/decision-log.md)) |
| 시도별 2019년 이전 | ❌ 2020년부터 제공 |
| 조사 기준일 | ✅ **매년 4월 1일** ([data-audit.md §10.2](docs/data-audit.md)) |
| 잠정치/확정치 구분 | ⚠️ 출처가 구분을 제공하지 않음 — 화면에 "미확인" |
| 2025년 공표 비율 | ⚠️ 정수 반올림 — 직접 계산값 사용 |

---

## 9. 라이선스

**코드**: [MIT License](LICENSE) © 2026 Taehyeong Lim

**데이터**: 코드 라이선스와 별개로 각 출처의 조건을 따릅니다.
- 통계 데이터 — 교육부·한국교육개발원 「교육기본통계」 (KOSIS·e-나라지표 경유). 이용 시 출처를 표시하세요
- 행정경계 — 통계청 SGIS 공공누리 제1유형, 가공분 [vuski/admdongkor](https://github.com/vuski/admdongkor) CC BY 4.0 ([geo-source.md](docs/geo-source.md)의 출처표시 문구 유지)

---

## 문서

| 문서 | 내용 |
|---|---|
| [**operations.md**](docs/operations.md) | ★ 운영 — 데이터 갱신 런북·배포·보안 |
| [project-brief.md](docs/project-brief.md) | 프로젝트 개요·원칙 |
| [**data-audit.md**](docs/data-audit.md) | ★ 데이터 가용성 감사 — 모든 조사 증거 |
| [product-requirements.md](docs/product-requirements.md) | 제품 요구사항·수용 기준 |
| [data-dictionary-draft.md](docs/data-dictionary-draft.md) | 스키마·매핑표·검증 규칙 |
| [architecture.md](docs/architecture.md) | 시스템 구조·보안 설계 |
| [design-system.md](docs/design-system.md) | 색상·타이포·접근성 |
| [testing-strategy.md](docs/testing-strategy.md) | 위험 기반 테스트 전략 |
| [implementation-roadmap.md](docs/implementation-roadmap.md) | 워크스트림·의존관계 |
| [**decision-log.md**](docs/decision-log.md) | ★ 설계 결정 변경 기록 (DL-001~007) |
| [qa-report.md](docs/qa-report.md) | E2E·접근성 검증 결과와 결함 조치 |
| [geo-source.md](docs/geo-source.md) | 행정경계 출처·라이선스·가공 기록 |
| [ADR-001](docs/adr/001-data-ingestion-architecture.md) · [002](docs/adr/002-map-library.md) · [003](docs/adr/003-chart-library.md) | 아키텍처 결정 기록 |
