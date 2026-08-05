# K-MOSAIC Round 4 E2E·접근성 QA 보고서

실행일: 2026-08-05 (Asia/Seoul)

## 실행 환경

- 실행 명령: `PLAYWRIGHT_PORT=3001 pnpm test:e2e`
- 정적 서버: `pnpm build && pnpm exec serve out -l 3001`
- Playwright: `@playwright/test@1.62.1`
- 브라우저: Chromium (Playwright 설치 버전 151.0.7922.34)
- 최종 결과: 23개 중 21개 통과, 2개 실패
- HTML 리포트: [e2e/playwright-report/index.html](../e2e/playwright-report/index.html)

기본 포트 3000은 실행 당시 기존 `next-server`가 사용 중이었다. `playwright.config.ts`는 포트 점유를 사전 검사해 `ERROR: port 3000 is already in use`로 실패하도록 구성했으며, 실제 QA는 충돌을 피하기 위해 3001에서 실행했다.

## 시나리오별 결과

| ID | 시나리오 | 결과 | 근거 |
|---|---|---|---|
| 1 | 첫 화면 헤더·브랜드·기준 연도·갱신일·전국 지표 | 통과 | 2025, 갱신일 2026. 8. 5., 202,208명 확인 |
| 2 | 17개 시·도 지도 path와 순위 표 17행 | 통과 | `path[role="button"]` 17개, 순위 `tbody tr` 17개 |
| 3 | 서울 선택 후 상세 정보 | 실패 | 서울 path 마우스 클릭 시 제주 path가 pointer event를 가로챔 |
| 4 | 연도 변경 시 지도·전국 지표·순위 갱신 | 통과 | 2022 전환 후 168,645명, 지도 aria-label·순위 변경 확인 |
| 5 | 학생 수 ↔ 비율 전환 및 범례·척도 변경 | 통과 | `aria-pressed`, 지도 aria-label, 범례 %, 비율 순위 확인 |
| 6 | 학교급 필터 및 URL 재방문 유지 | 통과 | 초등학교 선택 후 `level=elementary` 재방문 확인 |
| 7 | 지역 최대 3개 비교 및 4번째 안내 | 통과 | 3개 선택, 4번째 선택 거부 및 안내 확인 |
| 8 | CSV 다운로드·출처 주석 | 통과 | 다운로드 이벤트, UTF-8 BOM, 출처·기준연도·계산식 확인 |
| 9 | 출처·기준일·통계표 ID | 통과 | `/sources/`, `F008403`, `DT_1963003_002`, `미확인`, 계산식 확인 |
| 10 | 360×740 모바일 핵심 기능·가로 스크롤 | 통과 | 연도·비율 전환, 17 path, `scrollWidth <= innerWidth` 확인 |
| 11 | API 키 네트워크 URL·JavaScript 번들 노출 | 통과 | `.env.local`에서 읽은 값으로 요청 URL 및 인라인/외부 스크립트 본문 검사 |
| 12 | 존재하지 않는 경로 오류 화면 | 통과 | 정적 `/r4-e2e-does-not-exist` 응답 404 및 not-found 문구 확인 |

학생 유형별 필터가 없는 것은 DL-001에 따른 정상 동작으로 판정했다. 화면의 미제공 안내도 확인했다. `전국 평균` 문구가 없고 `전국 값`으로 표시되는 것은 DL-002에 따라 통과다.

추가로 PRD §4.1의 2025년 전국 비율 수용 기준도 검사했으며, 아래 결함으로 실패했다.

## 접근성 검증 결과

| 항목 | 결과 | 검증 방법 |
|---|---|---|
| 키보드 Tab·Enter·Space·Escape로 필터·지역 조작 | 통과 | Tab 이동, 비율 Enter, 서울 체크박스 Space, 지도 Enter, Escape 해제 |
| 지도 17개 지역 role·aria-label·값 포함 | 통과 | DOM 단언으로 role, aria-label, 명/비율/데이터 없음 값 확인 |
| 지도·차트 표 대체 데이터 | 통과 | 지도 표와 전국 추세 표의 caption·헤더 확인 |
| 모든 select/input 연결 label | 통과 | `label[for]` 또는 enclosing label DOM 검사 |
| 포커스 표시 | 통과 | 키보드 포커스 후 computed outline/box-shadow 확인 |
| 이미지·아이콘 대체 텍스트/aria-hidden | 통과 | `img` alt 및 SVG semantics/aria-hidden DOM 검사 |

### 자동화하지 못한 항목

- `@axe-core/playwright` 등 axe 자동 검사 패키지가 설치되어 있지 않아 axe 전 페이지 검사는 실행하지 못했다. 직접 DOM 단언으로 대체했다.
- 실제 스크린리더 발화 품질과 지도 값의 음성 전달은 자동화하지 못했다.
- 색상 대비 수치와 색각 시뮬레이션은 자동 측정하지 못했다. 다크모드 전환 및 산출물 캡처만 확인했다.
- native `<select>`의 실제 운영체제 키보드 팝업에서 Arrow 키로 값이 바뀌는 동작은 별도 수동 검증이 필요하다. 자동 키보드 검사는 Tab 및 Enter/Space/Escape 상호작용을 중심으로 통과시켰고, 학교급·연도 값 자체는 E2E의 native select 조작으로 검증했다.
- 정적 앱의 실제 데이터 조회 예외를 주입하지 않고, 지시서가 허용한 not-found 대체 경로로 오류 화면을 검증했다.

## 결함 목록

| 심각도 | 결함 | 재현·영향 |
|---|---|---|
| 높음 | 지도에서 서울 path의 마우스 클릭이 동작하지 않음 | `dashboard.spec.ts` E3에서 서울 path 클릭이 5초 내 완료되지 않았다. 제주 path가 pointer event를 가로채는 로그가 반복됐다. 지도 핵심 상호작용과 PRD M3의 클릭 경로에 영향. 키보드 Enter와 체크박스 선택은 동작했다. |
| 중간 | 2025년 전국 비율 표시 정밀도가 PRD 수용 기준과 불일치 | 데이터 직접 계산값은 4.0238%로 PRD 기대값은 4.02%이나 화면에는 4.0%로 표시됐다. 비율 정밀도 및 인용 정확성에 영향. |

src 수정은 하지 않았으며, 위 결함은 테스트 실패와 함께 남겼다.

## 산출물

| 화면 | 파일 |
|---|---|
| 데스크톱 메인 | [desktop-main.png](../e2e/screenshots/desktop-main.png) |
| 지역 선택 상태 | [region-seoul-selected.png](../e2e/screenshots/region-seoul-selected.png) |
| 비율 모드 | [rate-mode.png](../e2e/screenshots/rate-mode.png) |
| 모바일 메인 | [mobile-main.png](../e2e/screenshots/mobile-main.png) |
| 출처 페이지 | [sources-page.png](../e2e/screenshots/sources-page.png) |
| 다크모드 | [dark-mode.png](../e2e/screenshots/dark-mode.png) |

## 빌드·정적 검사

- `pnpm build`: 통과
- `pnpm typecheck`: 통과
- `pnpm lint`: 통과
- API 키 값은 로그·리포트·스크린숏에 출력하지 않았다.
- 성능 수치(LCP 등)는 이번 QA에서 별도 측정하지 않았다.

---

# 결함 조치 결과 (Lead Integrator, 2026-08-05)

위 결함 2건을 조사·수정하고 전체 검사를 재실행했다.

## 결함 1 (심각도 높음) — 지도 클릭이 동작하지 않음 → **수정 완료**

**QA 관찰**: 서울 path 클릭 시 제주 path가 pointer event를 가로챔.

**실제 원인**: 관찰된 것은 증상이고, 원인은 **지도가 전혀 렌더되지 않는 것**이었다.
브라우저 진단 결과 17개 path의 `getBBox()`가 **전부 동일**했고(`179,24,512,512`), 각 path의
`d` 문자열에 실제 지역 폴리곤 외에 **화면 전체 사각형 서브패스**가 붙어 있었다.

```
서울 d = M515.6,195.1 … Z          ← 실제 서울
        M581,24 L581,466 L139,466 L139,24 Z   ← clipExtent 사각형 (불필요)
```

**근본 원인**: **링 감김 방향(winding order) 규약 충돌**.
RFC 7946은 외곽 링을 반시계 방향으로 규정하고 `public/geo/sido.geo.json`도 이를 따랐으나
(1,115개 링 전부 반시계 확인), **d3-geo는 GeoJSON을 구면 기하로 해석해 시계 방향 외곽 링을
기대한다**. 반시계 링은 "지구 전체에서 이 지역을 뺀 영역"으로 해석되어, clipExtent로 자를 때
클립 사각형이 경로에 삽입된다. 그 결과 마지막에 그려지는 제주가 지도 전체를 자기 색으로 덮고
모든 포인터 이벤트를 가로챘다.

실험으로 확정:

| 링 방향 | 서브패스 | bounds |
|---|---|---|
| 원본 CCW (RFC 7946) | 2개 | 전체 범위 ❌ |
| 반전 CW | 1개 | 서울만 ✅ |

**수정**: `src/lib/visualization/projection.ts`에 `toD3Winding()`을 추가하고
`ChoroplethMap`이 렌더·투영 양쪽에서 이를 거치도록 했다.

수정 위치를 데이터가 아니라 렌더 계층으로 잡은 이유 — `public/geo/sido.geo.json`은 공개
산출물이므로 RFC 7946 표준을 유지하는 편이 다른 소비자에게 안전하다. d3 고유의 규약 차이는
d3를 쓰는 곳에서 흡수한다.

**검증**: 17개 path의 bbox가 서로 달라졌고(인천은 섬 때문에 서브패스 110개), 서울 클릭이
동작하며, E2E `E3 서울을 선택하면 서울 상세 정보가 열린다`가 통과한다.

## 결함 2 (심각도 중간) — 2025년 비율 표시 정밀도 → **명세 모순 해소**

앱 결함이 아니라 **설계 문서 간 모순**이었다.
- `product-requirements.md` §4.1: `4.02%` (소수 2자리)
- `design-system.md` §3.3: "표시 1자리, 저장 4자리"

`docs/decision-log.md` **DL-007**에서 **소수 1자리**로 확정하고 PRD 예시를 정정했다.
근거는 출처의 공표 관행(소수 1자리), 순위 계산이 이미 저장 정밀도(4자리)를 쓴다는 점,
그리고 직접 계산의 목적(공표 `4%` → 표시 `4.0%`)이 1자리로 충족된다는 점이다.
전체 정밀도는 CSV·JSON 다운로드로 제공한다.

E2E 테스트를 DL-007에 맞춰 갱신하되 검증 의도를 잃지 않도록,
**스냅숏이 4.0238%를 보존하고 공표치가 4임을 함께 단언**하는 케이스를 추가했다.

## 재실행 결과

| 검사 | 결과 |
|---|---|
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test` (단위·통합) | ✅ 39/39 |
| `pnpm data:validate` | ✅ (경고 X8 16건은 각종학교 모수 과소에 따른 정상 경고) |
| `pnpm build` | ✅ 라우트 3개 정적 생성 |
| `pnpm test:e2e` | ✅ **24/24** |
| 비밀정보 스캔 | ✅ |

> E2E는 포트 3000이 외부 프로세스에 점유되어 `PLAYWRIGHT_PORT=4180`으로 실행했다.

## 성능 실측 (로컬 정적 서버 기준)

| 지표 | 값 |
|---|---|
| LCP | 152 ms |
| FCP | 68 ms |
| DOMContentLoaded | 48 ms |
| load | 101 ms |
| `out/index.html` | raw 1,271 KB / **gzip 127 KB** |
| `out/sources/index.html` | raw 55 KB / gzip 6 KB |
| 전송 총량(비압축 본문) | 2,488 KB (document 1,271 / script 1,189 / css 29) |

> ⚠️ **로컬 `serve` 기준이므로 네트워크 지연이 없다.** 실제 배포 환경의 LCP는 이보다 크다.
> 스크립트 1,189 KB는 스냅숏이 HTML RSC 페이로드와 클라이언트 청크에 이중으로 실린 것으로
> 보인다. gzip 후에는 차단 요인이 아니나 최적화 여지가 있다 (아래 후속 과제).

## 후속 과제

| 우선순위 | 항목 |
|---|---|
| 중 | 스냅숏 이중 직렬화 제거 — 클라이언트에 필요한 필드만 전달 |
| 중 | 지도 여백 — 독도(131.87°E) 포함으로 `fitExtent`가 동쪽으로 늘어나 본토가 좌측 편향. 도서 인셋(inset) 처리 검토 |
| 중 | axe 자동 접근성 검사 도입 (`@axe-core/playwright` 미설치로 DOM 단언으로 대체함) |
| 낮 | 색상 대비·색각 시뮬레이션 자동 측정 |
| 낮 | 실제 네트워크 조건에서의 성능 재측정 |
