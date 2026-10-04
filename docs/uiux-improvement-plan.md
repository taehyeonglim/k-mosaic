# K-MOSAIC UI/UX 개선 계획

> **2026-10 이후**: 이 문서는 결함 수리 중심의 이전 정비 기록이다. 시각 디자인은 그 뒤 전면 개편됐다 — 현재 규칙은 [design-system.md](./design-system.md), 결정 배경은 [decision-log.md](./decision-log.md)의 DL-011 을 본다.


> **작성 근거**: `e2e/screenshots/uiux-audit/` 스크린숏 7장 실측 + `docs/design-system.md`·`docs/product-requirements.md`·`docs/decision-log.md` 대조 + `src/` 전 구현 파일 검토.
> **범위**: 시각·레이아웃·인터랙션 개선만. 데이터·계산·기능·접근성 속성은 전부 유지한다.
> **검증 게이트**: `npm run lint && npm run typecheck && npm run test:e2e` (E2E 32개, axe 8개 포함) 전부 통과.

---

## 0. 근본 원인 (모든 진단에 앞서)

**약 18종의 컴포넌트 CSS 클래스가 14개 tsx 파일에서 사용되지만 어디에도 정의돼 있지 않다.**

`src/styles/globals.css`는 디자인 토큰(색·폰트·반경·그림자)만 선언하고, 마크업이 참조하는
`card` `viz-grid` `viz-stat` `viz-stat-value` `viz-controls` `viz-row` `viz-badge`
`btn` `btn-ghost` `form-label` `form-select` `form-check` `form-check-input` `form-check-label`
`table` `table-responsive` `text-small` `text-destructive`
클래스는 **한 줄도 정의가 없다** (`grep` 전수 확인, CSS 파일은 `globals.css` 하나뿐).

그 결과:
- 지표 "카드"가 카드 없이 세로 텍스트로 렌더됨 (관찰 문제 1)
- 버튼(`btn`)이 맨 텍스트로 렌더됨 — "대학 외국인 유학생 통계 보기" 링크, 지표 전환, 다운로드 버튼 전부
- 셀렉트·체크박스가 브라우저 기본 스타일 (관찰 문제 4)
- 순위 표가 무스타일 텍스트 나열 (관찰 문제 5)
- `text-small`이 무효라 라벨과 값의 크기 차이가 사라짐 (관찰 문제 6)
- `text-destructive`가 무효라 **오류 안내가 색 없이 렌더됨** (최대 3개 지역 경고)

또 하나의 구조적 원인: **완성도 높은 스타일드 컴포넌트가 이미 존재하지만 아무 데서도 쓰이지 않는다.**
`MetricValue`(숫자 계층 lg/md/sm + tabular-nums), `DeltaValue`(화살표+부호), `SegmentedControl`, `SelectField`는 design-system §3.1·§2.3을 정확히 구현해 두고도 `MetricCardRow`·`FilterBar`가 미정의 클래스로 자체 렌더한다.

→ **이번 개선의 본질은 "새 디자인 발명"이 아니라, 이미 문서·코드에 존재하는 의도를 화면에 연결하는 것이다.**

---

## 1. 진단 요약

### P0 — 치명 (플랫폼의 신뢰성·판독성을 직접 훼손)

| # | 문제 | 근거 스크린숏 | 원인 파일 |
|---|---|---|---|
| P0-1 | **미정의 CSS 클래스 18종** → 카드·버튼·폼·표·경고색 전부 무스타일 | 모든 스크린숏 전반 | `src/styles/globals.css` (정의 부재) |
| P0-2 | **전국 개요에 숫자 계층·카드 그리드 부재** — 라벨과 값이 같은 크기(16px)로 세로 나열, 4열 그리드(§4.2) 미구현, 증감에 화살표·병기 없음(§2.3). "직접 계산한 비율"·"2020 기준 연도" 주석이 값과 동급 텍스트로 섞여 흐름이 끊김 | main-desktop-light.png 상단 "전국 개요" 카드, main-tablet-light.png 동일, foreign-desktop-light.png 개요 | `src/components/dashboard/MetricCardRow.tsx` (MetricValue/DeltaValue 미사용) |
| P0-3 | **순위 막대 차트가 지역코드 순으로 렌더** — 막대가 값 순이 아니어서 서열 판독 불가. 17개 카테고리를 360px 고정 높이에 넣어 Y축 라벨이 자동 생략돼 "2. 서울 → (라벨 없음) → 11. 대구" 식으로 뒤섞여 보임. 값 라벨 위치도 좌우 불규칙 | main-desktop-light.png 우측 "지역 순위" 상단 차트 (라벨 2→11→12→14→1→9→8→6→16 순), main-mobile-light.png 동일 | `src/app/dashboard-client.tsx` (`rankingRowsByMetric`이 `currentViews` 순서 유지), `src/components/charts/RankingBarChart.tsx` (정렬·높이·interval 미처리) |
| P0-4 | **다크모드 지도가 라이트 램프 그대로** — `createCountScale(..., 'light')` 하드코딩. `scale.ts`에 다크 분기와 `--km-map-*` 다크 토큰이 준비돼 있는데도 사용 안 됨. design-system §7·검증 D7 위반 | main-desktop-dark.png 지도 (라이트와 동일한 밝은 파랑) | `src/app/dashboard-client.tsx` L452·457, `src/app/foreign-students/foreign-students-client.tsx` 동일 패턴, `src/lib/visualization/scale.ts` |

### P1 — 중요 (정보 구조·밀도 문제)

| # | 문제 | 근거 스크린숏 | 원인 파일 |
|---|---|---|---|
| P1-1 | **순위 패널의 3중 중복** — 같은 데이터가 차트(17행) + 표(17행)로 두 번, "결측 지역은 순위에서 제외하고…" 고지가 한 카드 안에 3회, "절대 증가 인원 순위" 제목이 h3+caption으로 2회 렌더 | main-desktop-light.png 우측 패널 전체 (차트 아래 동일 값 표, 하단 미니 표 2개) | `src/app/dashboard-client.tsx` L758-796, `src/components/dashboard/RankingTable.tsx` |
| P1-2 | **빈 상태가 공간만 차지 + 제목 중복** — "지역 상세" 카드 제목 아래 빈 박스 안에 다시 "지역 상세" 제목, "선택 지역 추세"도 동일. 데스크톱에서 각 ~300px 낭비 | main-desktop-light.png 중하단 2곳, foreign-desktop-light.png (빈 상태가 **좌측 1순위 자리**, 실제 차트가 우측) | `src/app/dashboard-client.tsx` L839·884, `src/app/foreign-students/foreign-students-client.tsx` L520, `src/components/ui/EmptyState.tsx` |
| P1-3 | **필터가 장황하고 정렬이 깨짐** — "연도 2025 ˅학교급 전체 ˅"가 붙어 렌더, "지표" 아래 "학생 수/비율" 버튼이 무스타일이라 "학생 수비율"로 붙어 보임, 지역 17개 체크박스가 3열로 화면 폭 전체에 흩어짐(열 간격 ~400px) | crop: main-desktop-light.png "필터" 카드, main-tablet-light.png 동일 | `src/components/dashboard/FilterBar.tsx` |
| P1-4 | **헤더 메타 중복·어색** — 3번째 슬롯이 라벨 "데이터 출처" + 링크 텍스트 "데이터 출처"로 같은 말 2번. 개요 카드 하단에 "기준 연도: 2025 · 갱신일: 2026. 8. 5."가 헤더와 3중 중복. 모바일에서 메타 3종이 세로로 쌓여 첫 화면 ~250px 소비 | main-desktop-light.png 헤더 우측, main-mobile-light.png 상단 | `src/components/layout/AppHeader.tsx`, `src/app/dashboard-client.tsx` L675-678 |
| P1-5 | **출처 패널이 페이지 길이 폭증의 주범** — 소스 7건 × 필드 7개가 전부 세로 라벨/값 나열, 갱신일·기준일·정정치 값이 7건 모두 동일한데 반복, URL이 생 텍스트. 모바일 전체 높이 ~10,500px(CSS px)의 약 40%가 이 구간 | main-desktop-light.png·main-mobile-light.png "출처 및 계산식" 구간, sources-desktop-light.png | `src/components/dashboard/SourcePanel.tsx`, `src/app/sources/page.tsx` |
| P1-6 | **지도 카드 내부 여백 과다·카드 높이 불균형** — svg 높이가 `width+40`(정사각 이상)이라 본토와 제주 사이 빈 공간이 크고, 범례·키보드 힌트·척도 주석이 좌측에 세로 나열 | main-desktop-light.png 지도 카드 하단 1/3 | `src/components/map/ChoroplethMap.tsx` L49, `src/components/map/MapLegend.tsx` |
| P1-7 | **서브 헤더 행이 붕 뜸** — "대학 외국인 유학생 통계 보기"가 스타일 없는 텍스트로 좌측에, ThemeToggle이 우측에 떠 있음. 내비게이션인지 본문인지 불명 | main-desktop-light.png 헤더 바로 아래 행 | `src/app/page.tsx` L126-134, (동일 패턴) `src/app/sources/page.tsx`, `foreign-students/page.tsx` |
| P1-8 | **유학생 페이지 시계열의 자리 배치 역전** — 좌측(1순위 자리)에 빈 placeholder, 우측에 실제 데이터(전국 장기 추세). 기간 안내 문구가 카드 설명·차트 하단에 2회 중복 | foreign-desktop-light.png "시계열" 카드 | `src/app/foreign-students/foreign-students-client.tsx` L499-542 |

### P2 — 개선 (완성도)

| # | 문제 | 근거 | 원인 파일 |
|---|---|---|---|
| P2-1 | 모자이크 도트 장식이 **모든 카드 우상단 + 헤더 + 빈 상태**에 동일 반복 — §1.1 "타일 리듬"의 의도(지도·카드·순위가 격자 리듬 공유)가 아니라 스티커 붙이기가 됨. 카드 제목이 도트를 피하려 `pr-10`을 강제당함 | 모든 스크린숏의 카드 우상단 | `src/components/ui/Card.tsx` L15-25, `EmptyState.tsx`, `AppHeader.tsx` |
| P2-2 | 카드 제목이 `text-base`(16px)로 본문과 동급 — 섹션 위계 부재 (관찰 문제 6) | 전체 | `src/components/ui/Card.tsx` L30 |
| P2-3 | 지도 범례 7구간 칩이 2줄로 꺾여 판독 부담, 구간 텍스트 과밀 ("9,536명-13,542명"...) | main-desktop-light.png 지도 하단 | `src/components/map/MapLegend.tsx` |
| P2-4 | 시계열 차트 범례("○ 전국")와 결측 주석의 배치가 흩어짐, 빈 y축 여백 | main-desktop-light.png "시계열" | `src/components/charts/TrendChart.tsx` |
| P2-5 | 지도\|순위 병치 분기점이 `lg`(1024px) — design-system §4.3 표는 1280px 기준. 1024~1279px에서 순위 패널이 과밀 | main-tablet-light.png는 정상(적층)이나 1024-1279 구간 미확인 | `src/app/dashboard-client.tsx` L717, `foreign-students-client.tsx` L416 |

**참고 — 사실과 다른 관찰**: 관찰 문제 2(지도\|순위 병치 위반)는 실제로는 구현돼 있다 (`lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]` ≈ 67/33). 문제는 병치 자체가 아니라 **우측 패널의 내부 과밀(P1-1)과 좌측 지도의 여백(P1-6)** 이다.

---

## 2. 개선 원칙

1. **문서된 의도의 구현, 새 발명 금지.** design-system §3.1(숫자 4레벨), §4.2(4→2→1열 카드 그리드), §4.1(정보 구조 6단), PRD §3 와이어프레임(지도\|순위, 지역상세\|시계열)을 그대로 화면에 옮긴다.
2. **이미 있는 부품을 먼저 쓴다.** `MetricValue`·`DeltaValue`를 지표 카드에 연결하고, 미정의 클래스는 globals.css `@layer components`로 정의해 14개 파일을 한 번에 살린다. DOM 구조 변경을 최소화해 E2E 셀렉터(id·role·텍스트)를 보존한다.
3. **한 정보는 한 번만.** 제목 중복(카드 제목 = 빈 상태 제목, h3 = caption), 고지문 3회 반복, 헤더/카드의 기준연도 3중 표기를 각 1회로 줄인다. 단, **테스트가 개수를 고정한 텍스트는 예외** (§5 참조).
4. **윤리 장치는 시각적으로 강화하되 위치는 유지.** 결측 `—`·사선 패턴·순위 고지 배지·모집단 분리 고지·"전국 값" 표기는 제거·약화 금지. 경고색은 오류/품질 안내에만 쓰고 값 표현에는 쓰지 않는다 (E1).
5. **다크모드는 토큰으로 해결.** 지도 색을 JS 테마 감지 대신 `--km-map-*` CSS 변수 참조로 바꿔, 이미 정의된 라이트/다크 램프가 자동 적용되게 한다 (SVG `fill`에 `var()` 사용은 `RankingBarChart`가 이미 검증).
6. **문자열은 전부 `src/content/ko.ts` 경유.** 새 문구가 필요하면 키를 추가한다 (ko.ts 소유권은 태스크 A로 단일화).

---

## 3. 구체적 개선안

### 3.1 디자인 토큰·컴포넌트 클래스 정의 — `src/styles/globals.css` (P0-1 해소)

**타이포 스케일 토큰 추가** (`@theme inline`에 등록해 유틸리티로도 쓰게):

| 토큰 | 크기/행간 | 용도 (design §3.1 매핑) |
|---|---|---|
| `--text-metric-lg` | 2rem/1.1, 모바일 1.75rem, weight 650 | 레벨 1 핵심 지표 |
| `--text-metric-md` | 1.375rem/1.2, weight 600 | 레벨 2 보조 지표 (지역 상세) |
| `--text-title` | 1.125rem/1.4, weight 600 | 카드 제목 (h2) |
| `--text-small` | 0.8125rem/1.45 | 레벨 4 라벨·단위·주석 |

**`@layer components` 클래스 정의** (모두 기존 토큰만 사용):

- `.card` — 내부 타일용: `background: var(--km-color-surface-muted)/50` 수준의 옅은 면 + `border border-border` + `radius-md` + `padding 1rem`. (외곽 `Card` 컴포넌트가 이미 surface 카드이므로, 내부 `.card`는 **한 단계 낮은 타일**로 구분 — 모자이크 타일 은유)
- `.viz-grid` — `display:grid; gap:0.75rem; grid-template-columns:1fr` → `sm:2열` → `xl:4열` (§4.2의 4→2→1)
- `.viz-stat` — `display:flex; flex-direction:column; gap:0.375rem`
- `.viz-stat-value` — `font-size:var(--text-metric-lg)` 계열 + `font-variant-numeric:tabular-nums` + `letter-spacing:-0.01em`
- `.btn` — `inline-flex items-center gap-1.5; min-height:2.5rem; padding:0 0.875rem; radius-md; border border-border; background surface; font-size 0.875rem; font-weight 500` + hover `background surface-muted` + `:focus-visible` 2px focus 링 + **`[aria-pressed="true"]` 상태: `background accent; color 흰색(라이트)/canvas(다크); border accent`** — 지표 전환·테마 토글이 자동으로 선택 상태를 얻음
- `.btn-ghost` — 테두리·배경 제거 변형
- `.form-label` — `display:flex; flex-direction:column; gap:0.375rem; font-size:0.875rem; font-weight:500` (FilterBar의 라벨-셀렉트 세로 묶음이 이 구조)
- `.form-select` — `SelectField.tsx`의 클래스와 동일 사양: `min-h-10 rounded-md border border-border bg-surface px-3 text-sm + focus-visible 링`
- `.form-check` — 칩형 라벨: `inline-flex items-center gap-2; min-height:2.5rem; padding:0.375rem 0.75rem; radius-md; border border-border; cursor:pointer` + `:has(:checked)` 시 `border-accent + background accent/10`. **네이티브 체크박스는 그대로 보이게 유지** (`.form-check-input`: `width/height:1rem; accent-color:var(--km-color-accent)`) — E10이 checkbox 가시성을 검증하므로 sr-only 금지
- `.table` — `width:100%; font-size:0.875rem; border-collapse` + `th: text-small·text-muted·padding 0.5rem·하단 보더` + `td: padding 0.5rem·행 구분선·tabular-nums` + `tbody tr:hover background surface-muted/50` + `caption: caption-side top, text-small, text-muted, text-align:start, padding-bottom 0.5rem`
- `.table-responsive` — `overflow-x:auto; min-width:0`
- `.viz-controls` — `display:grid; gap:1rem;` → `sm:grid-cols-2` → `lg:grid-cols-[repeat(3,minmax(0,13rem))]` (연도·학교급·지표가 한 행)
- `.viz-row` — `display:flex; flex-wrap:wrap; gap:0.5rem`
- `.viz-badge` — Badge caution 톤과 동일한 필 형태 (quality-note 색)
- `.text-small` — `font-size/행간 = --text-small`
- **`--km-color-destructive` 토큰 신설** (라이트 `#b3261e`, 다크 `#ffb4ab`) + `@theme`에 `--color-destructive` 등록 → 기존 `text-destructive` 사용처가 즉시 유효해짐

**수용 기준**
- [ ] 위 18종 클래스가 정의되고, DevTools에서 `.btn`·`.card`·`.table` 적용 확인
- [ ] `grep -rn "className=\"[^\"]*\b(btn|card|viz-|form-|table|text-small|text-destructive)" src` 의 모든 사용처가 정의된 클래스만 참조
- [ ] 라이트/다크 각각에서 `.btn`·`.form-check`·`.table` 텍스트 대비 4.5:1 이상 (axe 8개 통과로 검증)
- [ ] 지역 4개째 선택 시 경고문이 destructive 색으로 보임

### 3.2 전국 개요 지표 카드 — `MetricCardRow.tsx` (P0-2 해소)

- 각 항목을 `.card .viz-stat` 타일로 유지하되 내부를 교체:
  - 라벨: `text-small text-muted` (레벨 4)
  - 값: **`MetricValue`** (`size="lg"`) 사용 — 미사용 컴포넌트 연결
  - 전년 대비 항목: **`DeltaValue`** 사용 → `↑ +8,394명 (+4.3%)` 형태로 화살표+부호 병기 (§2.3)
  - 주석("직접 계산한 비율", "2020 기준 연도"): `text-small text-muted`, 값 아래 한 줄
- `data-key`·`data-unit` 속성, `aria-label` **그대로 유지** (E4·E10이 `[data-key="student-count"]` 텍스트를 검증)
- 비율 값은 단독 요소로 렌더 유지 — `getByText('4.0%', { exact: true })`가 전국 개요 region 안에서 매칭돼야 함 (data-integrity). `MetricValue`의 percent 포맷은 `4.0%`를 출력하므로 값 요소에 다른 텍스트를 붙이지 않는다
- 개요 카드 하단의 "기준 연도: 2025 · 갱신일: …" 중복 라인은 `dashboard-client.tsx`에서 제거 (헤더가 이미 표시, E1은 header 내부만 검증)

**수용 기준**
- [ ] 데스크톱(≥1280px) 4열, 태블릿 2열, 모바일 1열 그리드
- [ ] 값 폰트가 라벨의 2배 이상 (32px vs 13px), tabular-nums 적용
- [ ] 전년 대비에 방향 화살표 + 부호 + 괄호 증감률 표시
- [ ] `[data-key="student-count"]`가 `202,208명`(2025)·`168,645명`(2022)을 포함 (E4·E10 그대로 통과)
- [ ] 전국 개요 region 안에 exact `4.0%` 텍스트 존재

### 3.3 순위 패널 재구성 — `RankingBarChart.tsx`, `RankingTable.tsx`, `dashboard-client.tsx` (P0-3·P1-1 해소)

**차트 (RankingBarChart)**
- 컴포넌트 내부에서 `rows`를 `rank` 오름차순 정렬 후 렌더 (전달 순서 의존 제거)
- 높이를 고정 360px → `행 수 × 26px + 40px` 동적 계산, `YAxis interval={0}`으로 17개 라벨 전부 표시, `width`는 유지(152) 또는 지역명 최장 "전북특별자치도" 기준 132px로 축소
- 값 라벨(`LabelList`)은 항상 막대 우측, `text-small` 크기

**표 (RankingTable) — 시각 계층 부여**
- 17행 표는 유지하되(E2가 `tbody tr` 17개 검증) 값 셀에 **인라인 비율 막대** 추가: 값 셀 배경에 `linear-gradient` 또는 셀 내 `span`(높이 4px, `--km-map-count-5` 색, 최대값 대비 %폭)을 값 텍스트 아래 배치 — 색만으로 전달 금지 원칙에 따라 숫자 병기 유지
- 1~3위 행의 순위 셀만 `font-weight:600` (색상 아닌 굵기로 강조)
- `disclaimer`(결측 고지)는 표별 렌더에서 **카드당 1회** 렌더로 이동: `RankingTable`의 `disclaimer` prop을 optional로 바꾸고, `dashboard-client.tsx`에서 순위 카드 최상단(고지 배지 아래)에 한 번만 출력

**카드 구성 (dashboard-client)**
- 순서: 고지 배지 → 결측 고지 1회 → 차트(정렬됨) → 상세 표(`<details>` 없이 그대로, 단 차트와 표 사이 `h3` "전체 표" 같은 새 제목은 추가하지 않음 — 기존 aria-label 구조 유지) → 증감 순위 2종
- 증감 순위 2종은 `xl:grid-cols-2` → **1열 세로 적층으로 변경** (40% 폭 카드 안 2열은 과밀), h3 제목은 유지하고 `RankingTable`의 `caption`은 `sr-only` 처리 대신 **caption 텍스트를 h3와 다른 용도(단위 설명)로 두거나 시각적으로 숨김** — 접근성 표 대체 표현이므로 caption 요소 자체는 제거 금지

**수용 기준**
- [ ] 차트 막대가 위→아래로 값 내림차순, 17개 라벨 전부 표시
- [ ] '학생 수 순위' region의 표 `tbody tr` 17개 유지 (E2)
- [ ] "결측 지역은…" 문구가 순위 카드 안에 1회만 등장
- [ ] '비율 순위' region에 `%` 포함 (E5)
- [ ] 표 각 행에서 값 대비 시각 표현(막대)이 보이되, 숫자·순위 텍스트는 그대로

### 3.4 다크모드 지도 램프 — `src/lib/visualization/scale.ts` (P0-4 해소)

- `palette()`가 `interpolateBlues` 문자열 대신 **`var(--km-map-count-1)`~`var(--km-map-count-7)` / `var(--km-map-rate-1)`~`7`을 반환**하도록 변경. `missingColor`도 `var(--km-color-missing)` 반환
- 비율 스케일은 연속 보간 대신 **7단계 양자화**로 전환 (`scaleQuantize` 또는 domain 균등 분할 → rate 변수 7종). 근거: 지도 대상이 17개 지역뿐이라 연속 램프의 이점이 없고, CSS 변수 참조로 라이트/다크 램프가 **JS 테마 감지 없이** 자동 전환됨. 범례는 이미 7구간 표시라 시각 변화 없음
- `breaks()`의 숫자 반환은 유지 (범례 구간 텍스트에 사용)
- 호출부(`dashboard-client.tsx`·`foreign-students-client.tsx`)의 `'light'` 인자는 시그니처 호환을 위해 유지해도 된다(색 결정에 미사용). **호출부 파일 수정 불필요** — 태스크 간 파일 충돌 방지
- SVG `fill`에 `var()`가 동작함은 `RankingBarChart`의 `fill="var(--km-map-count-6)"`로 기 검증

**수용 기준**
- [ ] 다크모드에서 지도 채색이 `--km-map-*-N` 다크 값(어두운 배경용 램프)으로 렌더
- [ ] 라이트 지도는 기존과 시각적으로 동일 계열
- [ ] 범례 칩 색과 지도 색 일치, 결측 사선 패턴 유지
- [ ] E5(범례 리스트 aria-label '비율', % 포함)·E11(다크 전환) 통과

### 3.5 빈 상태·자리 배치 — `EmptyState.tsx`, `dashboard-client.tsx`, `foreign-students-client.tsx` (P1-2·P1-8 해소)

- `EmptyState`: 세로 패딩 축소(`p-6~8` → `py-5`), 도트 장식 제거, **title을 optional**로 — 카드 제목과 동일한 제목 반복 제거. 설명 문구("지역을 선택하면 상세 정보가 표시됩니다.")는 **문자 그대로 유지** (E-테스트가 exact text 검증)
- `dashboard-client.tsx`: PRD §3 와이어프레임대로 **"지역 상세"와 "시계열"을 데스크톱에서 한 행(1fr 1fr)으로 병치**. 미선택 시 지역 상세 자리는 낮은 안내 스트립(높이 ≤120px). `section#region-detail`의 `aria-label`·region 구조는 유지 (a11y 스펙이 '지역 상세' region을 조회)
- `foreign-students-client.tsx`: 시계열 카드에서 **전국 장기 추세를 좌측(1순위), 시도별 추세를 우측**으로 교체. 시도별이 빈 상태일 때는 안내 스트립. 기간 안내 문구는 카드 설명 1곳으로 통합(차트 하단 중복 제거)

**수용 기준**
- [ ] 미선택 상태의 메인 페이지에서 빈 박스 2개의 합계 높이가 기존 대비 50% 이상 감소
- [ ] '지역을 선택하면 상세 정보가 표시됩니다.' exact 텍스트 존재
- [ ] 서울 선택 시 '서울특별시' heading 표시 (E3), Escape 후 region '지역 상세'에서 히든 처리 동작 유지
- [ ] 유학생 페이지에서 실제 데이터 차트가 항상 좌측 우선

### 3.6 필터 바 — `FilterBar.tsx` (P1-3 해소)

- 상단 행: `.viz-controls` 3열 — 연도 셀렉트, 학교급 셀렉트, 지표 토글. 라벨은 `.form-label` 세로 묶음. **접근성 계약 유지**: `#filter-year`·`#filter-school-level` id, 라벨 접근명 정확히 '연도'·'학교급'(combobox name exact 검증), DOM 순서 연도→학교급 (Tab 순서 검증)
- 지표 토글: 기존 `aria-pressed` 버튼 2개 유지(**`SegmentedControl`로 교체 금지** — role이 radio로 바뀌어 `getByRole('button', { name: '비율' })` 실패). `.btn` + `[aria-pressed="true"]` 스타일로 세그먼트 외형만 부여, 두 버튼을 `inline-flex` 그룹으로 묶어 간격 0·모서리 연결
- 지역 선택: 17개를 `.form-check` 칩 그리드로 — `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` (데스크톱 3행 이내), 칩 안에 네이티브 체크박스 + 지역명. `#filter-region-*` id·checkbox role·접근명 유지
- "최대 3개…" 안내는 legend 옆 인라인 `text-small`, 유형 미제공 고지는 카드 하단 1줄 유지 (DL-001)

**수용 기준**
- [ ] 데스크톱에서 필터 카드 전체 높이 ≤ 280px (현 ~480px)
- [ ] E5(버튼 name·aria-pressed)·E6(#filter-school-level)·E7(checkbox 3개 제한)·a11y(연도→학교급 Tab 순서, combobox name '연도') 통과
- [ ] 선택된 칩이 비선택과 배경·테두리로 구분

### 3.7 헤더·서브 내비 — `AppHeader.tsx`, `page.tsx`·`sources/page.tsx`·`foreign-students/page.tsx` (P1-4·P1-7 해소)

- `AppHeader` 우측: `dl` 3분할 → **한 줄 인라인 메타** `기준 연도 2025 · 갱신일 2026. 8. 5.` (dt `text-small text-muted`, dd `font-semibold tabular-nums`, 항목 간 `·` 구분) + 세 번째 슬롯은 dt 없이 **`.btn` 스타일 링크 1개** ("데이터 출처" / sources 페이지에선 "전국 개요"). 텍스트 노드 '기준 연도'·'2025'·'갱신일'·'2026. 8. 5.'는 header 안에 유지 (E1 exact text)
- 모바일: 메타를 브랜드 아래 한 줄 wrap으로 — 세로 3단 제거
- 서브 행: `page.tsx`의 링크+ThemeToggle 행을 `<nav aria-label={ko.foreignStudents.navigationLabel}>`로 감싸고 링크에 `.btn` 적용(이미 클래스 있음 — 3.1 정의로 자동 해결), 행 하단에 얇은 구분선 또는 여백 정리. 세 페이지 동일 패턴 적용

**수용 기준**
- [ ] 헤더 높이(데스크톱) ≤ 88px, 모바일 첫 화면에서 메타가 2줄 이내
- [ ] '데이터 출처' 문자열이 헤더에 1회만 (링크)
- [ ] E1의 header 내 exact 텍스트 4종 유지, `getByRole('link', { name: '전국 개요' })` (sources 헤더) 유지

### 3.8 출처 패널 — `SourcePanel.tsx`, `sources/page.tsx` (P1-5 해소)

- 각 소스를 **2열 압축 카드**로: 1행에 `통계표명(강조) + 통계표 ID(mono·Badge형)`, 2행에 `작성기관 · 제공처` 인라인, 3행에 원자료 링크를 **URL 생 문자열 대신 `.btn-ghost` 링크 텍스트 "원자료 링크 ↗"** (단, `sources.originalLinks` 키 재사용; URL은 `href`로만). 갱신일·기준일·정정치처럼 **7건 모두 동일한 값은 패널 상단 공통 메타 1곳으로 승격**하고 각 카드에서 제거
- 소스 카드들을 `sm:grid-cols-2` 그리드로 배치해 세로 길이 절반 이하로
- `/sources` 페이지: 카드 배치·타이포만 조정. **제목 텍스트·개수는 변경 금지** — axe 스펙이 heading '출처 및 계산식' **정확히 3개**, '계산식' heading을 포함한 section **정확히 1개**를 검증. '미확인' 값은 `dd` 요소로 유지 (E9가 `dd` 필터로 조회)

**수용 기준**
- [ ] 메인 페이지 출처 구간 높이 60% 이상 감소 (데스크톱 기준)
- [ ] E9: '출처 및 계산식' 텍스트 3회, `F008403`·`DT_1963003_002` visible, `dd` 내 '미확인' ≥1, 계산식 section 1개 — 전부 그대로 통과
- [ ] 모바일 E10에서 heading '출처 및 계산식' visible 유지

### 3.9 지도 카드·범례 — `ChoroplethMap.tsx`, `MapLegend.tsx` (P1-6·P2-3 해소)

- svg 높이 산식 `width+40` → `width×0.88` 수준으로 축소하고 projection fit 재확인 (17개 path·인셋 박스 유지)
- 범례: 칩 나열 → **연속 스와치 바 + 경계값 라벨** 형태(7칸 붙은 가로 바, 칸 아래 경계 숫자). `ol` + `aria-label={metricLabel}` 구조는 유지 (E5가 `getByRole('list', { name: '비율' })`을 조회) — li 안 텍스트에 구간값 유지, "데이터 없음" 사선 칩은 마지막 항목으로 유지
- 키보드 힌트·척도 고정 주석은 `text-small` 한 줄로 병합 배치 (`·` 구분), 범례와 함께 지도 하단 정리

**수용 기준**
- [ ] 지도 카드 내부의 무의미한 세로 여백 제거 (지도 하단 여백 ≤ 32px)
- [ ] `path[role="button"]` 17개·aria-label 형식·사선 패턴·인셋 주석 유지 (E2·a11y)
- [ ] 범례가 한 줄(데스크톱)로 들어가고 결측 항목 포함

### 3.10 시계열·기타 차트 — `TrendChart.tsx`, `SchoolLevelBreakdown.tsx` (P2-4)

- 범례를 차트 상단 우측으로 이동, 결측 주석은 카드 하단 1곳
- y축 라벨 `text-small`, 그리드선 `--km-color-border` 30% 톤
- 결측 구간 선 단절(T5)·주석 마커(DL-009) 로직은 손대지 않음

### 3.11 카드·장식 정리 — `Card.tsx`, `EmptyState.tsx` (P2-1·P2-2)

- 카드 제목 `text-base` → `--text-title`(18px·600). 설명은 `text-sm text-muted` 유지
- 모자이크 도트: 카드별 반복 제거. **헤더 브랜드 옆 1곳만 유지** (§1.1 로고 전개 의도) — `Card`의 도트 블록과 `pr-10` 삭제, `EmptyState` 도트 삭제. 도트는 `aria-hidden`이었으므로 접근성 영향 없음
- 카드 패딩 `p-4 sm:p-5` → `p-5 sm:p-6`으로 통일, 페이지 섹션 간격 `space-y-8` 유지·카드 내부 블록 간격 `space-y-4`로 통일 (관찰 문제 7의 리듬 불균일 해소)

---

## 4. 구현 태스크 분해 (병렬 실행, 파일 소유권 비중첩)

> 공통 규칙: 각 태스크는 아래 "담당 파일"만 수정한다. `src/content/ko.ts`·`src/styles/globals.css`는 **태스크 A 전용**이다. B·C는 기존 ko 키와 3.1에서 확정된 클래스명 계약만 사용한다 (마크업이 이미 해당 클래스명을 참조하므로 정의만으로 연동됨). 완료 조건은 공통으로 `npm run lint && npm run typecheck && npm run test:e2e` 전체 통과를 포함한다.

### 태스크 A — 기반 스타일 + 셸·출처 (P0-1, P1-4, P1-5, P1-7, P2-1, P2-2)

**담당 파일**
```
src/styles/globals.css            (단독 소유)
src/content/ko.ts                 (단독 소유 — 신규 키 필요 시)
src/components/ui/Card.tsx
src/components/ui/EmptyState.tsx
src/components/ui/Badge.tsx       (viz-badge와 톤 정합만)
src/components/layout/AppHeader.tsx
src/components/layout/AppFooter.tsx
src/components/layout/PageShell.tsx
src/components/dashboard/SourcePanel.tsx
src/app/page.tsx                  (서브 내비 행만 — DashboardClient props 불변)
src/app/sources/page.tsx
src/app/foreign-students/page.tsx (서브 내비 행만)
```

**작업**: §3.1 클래스·토큰 정의 전체, §3.7 헤더·서브 내비, §3.8 출처 패널, §3.11 카드 위계·도트 정리, EmptyState 슬림화(§3.5의 컴포넌트 측 절반 — title optional화·패딩 축소. 호출부 수정은 B·C가 담당).

**완료 조건**: §3.1·§3.7·§3.8·§3.11 수용 기준 + E1·E9 통과 + axe 8개(라이트/다크 × 2 viewport × 2 페이지) 통과 + `/sources` heading '출처 및 계산식' 3개·'계산식' section 1개 유지.

### 태스크 B — 메인 대시보드 본문 (P0-2, P0-3, P1-1, P1-2 메인, P1-3, P2-5 메인)

**담당 파일**
```
src/app/dashboard-client.tsx
src/components/dashboard/MetricCardRow.tsx
src/components/dashboard/FilterBar.tsx
src/components/dashboard/RankingTable.tsx
src/components/dashboard/RegionDetailPanel.tsx
src/components/dashboard/DownloadButtons.tsx
src/components/charts/RankingBarChart.tsx
src/components/charts/SchoolLevelBreakdown.tsx
src/components/ui/MetricValue.tsx
src/components/ui/DeltaValue.tsx
```

**작업**: §3.2 지표 카드(MetricValue/DeltaValue 연결, 중복 메타 라인 제거), §3.3 순위 패널(차트 정렬·동적 높이·interval 0, 표 인라인 막대, 고지 1회화, 증감표 세로 적층), §3.6 필터 바, §3.5의 메인 페이지 절반(지역 상세\|시계열 병치, EmptyState 호출부에서 중복 title 제거), 병치 분기점 `lg` → `xl`(P2-5), RegionDetailPanel 내부 지표 타일에 `MetricValue size="md"` 적용.

**완료 조건**: §3.2·§3.3·§3.5(메인)·§3.6 수용 기준 + E2~E8·E10·데이터 무결성('전국 값' 텍스트, '4.0%' exact, `[data-key="student-count"]`) + a11y 키보드 순서 통과. 360px 가로 스크롤 없음.

### 태스크 C — 지도·시계열·유학생 페이지 (P0-4, P1-6, P1-8, P2-3, P2-4)

**담당 파일**
```
src/lib/visualization/scale.ts    (단독 소유)
src/components/map/ChoroplethMap.tsx
src/components/map/MapLegend.tsx
src/components/charts/TrendChart.tsx
src/components/charts/ChartDataTable.tsx
src/app/foreign-students/foreign-students-client.tsx
```

**작업**: §3.4 CSS 변수 기반 지도 램프(다크 자동 대응 — 호출부 시그니처 불변이므로 B의 `dashboard-client.tsx`를 건드리지 않음), §3.9 지도 높이·범례 바, §3.10 시계열 정리, §3.5의 유학생 페이지 절반(전국 추세 좌측 우선, 기간 문구 중복 제거), 유학생 페이지 개요·필터·순위는 A·B가 만든 클래스·패턴이 그대로 적용되는지 확인만 (MetricCardRow·FilterBar는 B 소유 공용 컴포넌트라 자동 반영).

**완료 조건**: §3.4·§3.9·§3.10 수용 기준 + E2(경로 17개)·E5(범례 리스트)·E11(다크) 통과 + 다크모드 스크린숏에서 지도 램프가 어두운 배경용으로 렌더 + foreign 페이지에서 데이터 차트 좌측 배치.

**의존성 메모**: 세 태스크는 파일이 겹치지 않는다. 유일한 계약은 (1) 3.1의 클래스명 목록 — 이미 마크업에 존재하는 이름이므로 협의 불필요, (2) EmptyState `title` optional화(A) ↔ 호출부 title 생략(B·C) — A가 optional로 만들면 B·C가 생략 전이라도 하위 호환.

---

## 5. 하지 말 것 (위반 시 E2E·윤리 요구 파괴)

**E2E 계약 — 아래 셀렉터·텍스트·개수를 바꾸지 않는다**
- id: `#filter-year` `#filter-school-level` `#filter-region-*` `#main-content`
- 속성: `[data-key="student-count"]` 등 MetricCardRow의 `data-key`, 지도 `path[role="button"]` 17개와 aria-label 형식(`지역명, … 연도 YYYY …`), `svg[role="group"]`의 aria-label, html `data-theme`
- role/이름: 지표 전환은 **`aria-pressed` 있는 `button`** ('학생 수'·'비율' exact) — `SegmentedControl`(role=radio)로 교체 금지. 지역 선택은 **네이티브 checkbox** (지역명 exact, 화면에 보여야 함 — sr-only 금지). ThemeToggle 버튼 이름 'light'·'dark'·'system'과 aria-pressed 유지. 연도 combobox 접근명은 정확히 '연도'
- region/heading: '전국 개요' heading은 `/`에서 정확히 1개, '출처 및 계산식'은 `/sources`에서 heading 정확히 **3개**(줄이면 axe·E9 실패), '계산식' heading을 가진 section은 `/sources`에서 정확히 1개, region '지역 상세'·'학생 수 순위'·'비율 순위' aria-label 유지
- exact 텍스트: 헤더 내 '기준 연도'·'2025'·'갱신일'·'2026. 8. 5.', '지역을 선택하면 상세 정보가 표시됩니다.', '지역은 최대 3개까지 선택할 수 있습니다.', '4.0%', '전국 값', 'F008403', 'DT_1963003_002', '미확인'(`dd` 안), 계산식 문자열
- 구조 개수: 순위 표 `tbody tr` 17개, 지도 path 17개, 표의 caption 요소(접근성 대체 표현), `ChartDataTable`(visuallyHidden) 제거 금지
- Tab 순서: 연도 셀렉트 다음 포커스가 `#filter-school-level`
- **모바일에서 지도를 접거나 숨기지 않는다** — design-system §4.3에 "모바일 지도 접힘"이 있으나 E10이 360px에서 path 17개를 요구하므로 이번 범위에서 제외

**윤리·표기 (PRD §5, decision-log)**
- 결측 `—`(em dash)·`aria-label="데이터 없음"`·사선 패턴·"0명이 아님" 툴팁 문구 유지 (E9 윤리요구)
- 값 표현에 경고색·적색 사용 금지 (E1) — destructive 색은 오류 안내 전용
- 순위 고지 배지("순위는 교육의 우열이나…")·"전국 값" 표기(DL-002)·소수 1자리(DL-007)·유학생 모집단 분리 고지(DL-008)·2022=2023 중복 주석 마커(DL-009)·학생 유형 미제공 고지(DL-001) 제거·약화 금지
- 국기·민족의상·인종 고정관념·사람 일러스트 도입 금지 (design §1.2). 발산형 팔레트 금지

**기술 제약**
- 기능·데이터·계산(선택 로직, URL 동기화, CSV 내용, 순위·동률 규칙) 변경 금지
- JSX 한글 리터럴 금지 — 새 문구는 태스크 A를 통해 `ko.ts`에 추가
- 추가 의존성 설치 금지 (Tailwind v4 + 기존 recharts/d3 범위 내), `output:'export'` 정적 내보내기 유지
- 다른 태스크 담당 파일 수정 금지 (특히 `globals.css`·`ko.ts`는 A 전용)
- 스냅숏·`scripts/`·`e2e/` 테스트 코드 수정 금지 (테스트를 계획에 맞추지 말고 계획을 테스트에 맞춘다)
