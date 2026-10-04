# CLAUDE.md — K-MOSAIC

이 저장소에서 작업할 때 반드시 지켜야 할 사항입니다.

---

## ⛔ 절대 금지

| # | 금지 | 이유 |
|---|---|---|
| 1 | **실제 API 키를 파일·로그·커밋·픽스처·번들에 기록** | `.env.local` 외 어디에도 두지 않는다 |
| 2 | **KOSIS 요청 URL 전문을 출력** | 키가 쿼리스트링에 있다 — 반드시 `redact()` 경유 |
| 3 | `NEXT_PUBLIC_` 접두사 비밀키 생성 | 브라우저 번들에 노출된다 |
| 4 | **결측을 `0`으로 대체** | `null` ≠ `0`. 검증 V5가 차단한다 |
| 5 | **지역명 문자열로 조인** | 강원도→강원특별자치도 등 개칭으로 시계열이 끊긴다. 항상 `regionCode` |
| 6 | **KOSIS 항목명으로 값 매칭** | `학생수` 동명 항목이 두 개 있다 (아래 §3) |
| 7 | 공표 비율을 그대로 표시 | 2025년은 정수 반올림됨 — 계산값 사용 |
| 8 | `southkorea/southkorea-maps` 사용 | 라이선스 미표기 |
| 9 | AI 해석을 공식 통계처럼 표시 | 구조적으로 분리 |
| 10 | 검증 실패한 데이터로 스냅숏 갱신 | 옛 검증 데이터가 새 오염 데이터보다 낫다 |

---

## 1. 이 프로젝트의 가장 중요한 사실

> **KOSIS OpenAPI에는 다문화학생 통계가 없다.**

6개 독립 경로로 확인 완료 ([docs/data-audit.md](docs/data-audit.md)). 교육기본통계 43개 표를 `hasMore=false`까지 전수 열거했다.

**MCP나 KOSIS에서 다문화학생 통계를 다시 검색하지 마라.** 시간 낭비다.

데이터 계보:
```
분자  e-나라지표 F008403          HTML 파싱
분모  KOSIS DT_1963003_002/003/004/009   OpenAPI
비율  분자 ÷ 분모 × 100           직접 계산
```

---

## 2. 모수 정의 (역검증으로 확정)

```
전체 학생 수 = 초등학교 + 중학교 + 고등학교 + 각종학교
             (유치원·특수학교 제외)
```

근거: 후보 조합별 공표치 대조에서 이 조합만 ±0.05%p 이내 100% 일치. 특수학교를 넣으면 81.3%로 하락한다.

**이 정의를 바꾸려면 `pnpm data:verify-denominator`를 다시 돌려 근거를 갱신하라.**

---

## 3. 데이터 함정 (반드시 기억)

### 3.1 `학생수` 항목이 두 개다

KOSIS 개황표의 `학교현황별` 축에는 `학생수`가 **두 번** 등장한다.

| 위치 | 2024 서울 | 단위 |
|---|---|---|
| 일반 학생수 | 361,287 | `명` |
| 청소년육성단체 > 학생수 | 2,200 | (없음) |

→ **반드시 `UNIT_NM === '명'` 을 함께 검사한다.** 지역마다 오염 규모가 달라(대구 17,336) 합계만 봐서는 발견되지 않는다.

### 3.2 표마다 분류축 개수가 다르다

- `DT_1963003_002` (상반기): 시도별 / **설립주체별** / 학교현황별 → `objL1~objL3`
- `DT_1963003_002_S` (하반기): 시도별 / 학교현황별 → `objL1~objL2`

`_S` 표에 `objL3`를 보내면 `err=21`로 거부된다.

### 3.3 KOSIS rate limit은 200건/분이다

문서에는 1,000건/분으로 적혀 있지만 **실제는 200건/분**(`err=40`). 호출 간 400ms 이상 지연을 둔다.

### 3.4 세종 코드가 `07a`

KOSIS 교육기본통계 시도 코드는 행정표준코드가 아니다. 세종이 울산(`07`)과 경기(`08`) 사이에 `07a`로 삽입돼 있다. 숫자 파싱을 가정하지 마라. 매핑표는 `src/lib/constants/regions.ts` (`kosisEduC1`).

### 3.5 2025년 비율은 정수로 뭉개져 있다

전남 7.0 / 충남 6.0 / 세종 1.0 — 90개 중 89개가 `x.0` (1 미만 값 하나만 0.4). 표시에는 **항상 계산값**을 쓰고, 공표치는 `multiculturalStudentRatePublished`로 대조용 보존한다.

반올림 연도는 리터럴(`year === 2025`)로 지정하지 않는다. `integerRoundedYears()`(`src/lib/data/years.ts`)가 정수 비율 80% 기준으로 판별한다 — 2026년 이후에도 같은 처리가 적용된다.

### 3.6 연도는 원자료에서 파생한다

연도 배열·연도 비교를 리터럴로 두지 마라. 연례 갱신 때 코드를 고치게 된다.

- 수록 연도: e-나라·KOSIS 원자료에서 파생 (`assertContiguousYears`)
- e-나라 시도별 표는 **최근 6개년만** 준다. 빠진 과거 연도는 이전 스냅숏에서 보존한다 (`retainHistoricalYears`)
- 화면 문구의 연도는 `{start}~{end}` 템플릿으로 두고 스냅숏에서 채운다 (`src/content/template.ts`)
- 테스트 기대값도 스냅숏에서 파생한다 (`e2e/helpers.ts` `readSnapshotFacts`). 단, 2022년 168,645명 같은 외부 교차검증 값은 리터럴로 둔다

---

## 4. 명령어

```bash
pnpm data:refresh                           # 연례 갱신 (키 필요) — 절차는 docs/operations.md
pnpm data:validate                          # 다문화 검증 게이트 (V1~V9, X1~X11)
pnpm data:validate-foreign                  # 외국인 유학생 검증 게이트 (F1~F5, X3·X5·X9~X12)
pnpm data:check-upstream                    # 새 연도 공표 확인 (키 불필요)
pnpm data:verify-denominator               # 모수 역검증 (키 필요)
pnpm geo:build                              # 시도 경계 GeoJSON 재생성 (geo-source.md)
```

스냅숏은 **반드시 `pnpm data:*` 파이프라인으로만** 만든다. 검증을 통과하기 전에는 스냅숏·메타데이터를 쓰지 않는다 (금지 #10). 예전 `scripts/probe/build-snapshot.mjs`는 검증 없이 덮어써서 삭제했다.

데이터셋은 두 개다. **둘을 직접 비교하지 마라** ([DL-008](docs/decision-log.md)).

| 데이터셋 | 집단 | 출처 | 스냅숏 |
|---|---|---|---|
| 다문화학생 | 초·중등 (각종학교 포함) | e-나라 F008403 ÷ KOSIS 개황표 4종 | `multicultural-students.v1.json` |
| 대학 외국인 유학생 | 고등교육기관 재적 | KOSIS `DT_1963003_010_S` + e-나라 153401 | `foreign-students.v1.json` |

출처 메타데이터(`sources.v1.json`)는 두 데이터셋이 공유한다. 화면에서 출처를 읽을 때는 `selectSourceMeta(dataset)`로 반드시 데이터셋을 지정한다.

---

## 5. 코드 규칙

| 영역 | 규칙 |
|---|---|
| 타입 | TypeScript strict. 결측은 `T \| null` 로 명시 |
| 검증 | Zod 스키마가 단일 진실 원천. 스키마 불일치 시 빌드 실패 |
| 셀렉터 | **순수 함수**. UI 없이 단독 테스트 가능해야 함 |
| 문자열 | `src/content/` 사전 경유. JSX에 한글 리터럴 금지 |
| 숫자 | 저장은 소수 4자리, 표시는 1자리. 저장 단계에서 반올림 금지 |
| 시각화 | SVG만. Canvas는 접근성 요구와 충돌 |
| 로그 | `redact()` 미경유 문자열을 로그·에러에 넣지 않는다 |

---

## 6. 스냅숏은 커밋한다

```
data/raw/         ❌ gitignore (재현 가능)
data/snapshots/   ✅ 커밋 (연구 재현성)
data/metadata/    ✅ 커밋
```

스냅숏이 커밋되어야 "2026-08-05 기준 데이터"를 영구 인용할 수 있다.

---

## 7. 윤리 요구사항은 기능 요구사항이다

"나중에 문구 추가"가 아니라 **검증 대상**이다 ([PRD §5](docs/product-requirements.md)).

- 높은 비율에 경고색을 쓰지 않는다 (문제 함의 금지)
- "전국 평균"이 아니라 **"전국 값"** 이다 (17개 시도의 산술평균이 아님)
- 순위가 교육의 우열이 아님을 표시한다
- 결측 지역은 팔레트 최저색이 아니라 **사선 패턴**
- 다문화학생을 결손집단으로 표현하지 않는다

---

## 8. 작업 전 읽을 것

1. [docs/data-audit.md](docs/data-audit.md) — 무엇이 있고 없는지
2. [docs/operations.md](docs/operations.md) — 데이터 갱신 런북·배포·보안
3. [docs/adr/001-data-ingestion-architecture.md](docs/adr/001-data-ingestion-architecture.md) — 왜 정적 스냅숏인지
4. [docs/data-dictionary-draft.md](docs/data-dictionary-draft.md) — 스키마·검증 규칙
5. [docs/implementation-roadmap.md](docs/implementation-roadmap.md) — 작업 순서와 수용 기준
