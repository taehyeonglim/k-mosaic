# 기여 가이드

K-MOSAIC에 관심을 가져 주셔서 감사합니다. 데이터 오류 제보는 특히 환영합니다 — [데이터 오류 제보](https://github.com/taehyeonglim/k-mosaic/issues/new?template=data-error.yml) 양식을 써 주세요.

## 개발 환경

```bash
pnpm install          # Node.js ≥ 20, pnpm 11 (package.json 의 packageManager)
pnpm dev              # http://localhost:3000
```

웹 앱은 커밋된 스냅숏만 읽으므로 **API 키가 필요 없습니다.** 데이터 갱신은 [docs/operations.md](docs/operations.md)를 보세요.

## 테스트

```bash
pnpm typecheck            # tsc + src/ 의 .js 확장자 import 검사
pnpm lint
pnpm test                 # 단위·통합 (Vitest)
pnpm test:e2e             # E2E·접근성 (Playwright + axe) — 빌드 후 정적 서버로 실행
pnpm data:validate        # 다문화학생 스냅숏 검증 게이트
pnpm data:validate-foreign
```

- 포트 3000이 사용 중이면 `PLAYWRIGHT_PORT=4180 pnpm test:e2e`
- 처음 E2E를 돌릴 때는 `pnpm exec playwright install chromium`
- PR을 열면 CI가 위 검사와 basePath 빌드·비밀정보 스캔·E2E를 모두 돌립니다

**테스트 기대값을 리터럴로 쓰지 마세요.** 최신 연도·수치·갱신일은 스냅숏에서 파생합니다(`e2e/helpers.ts`의 `readSnapshotFacts`). 그래야 연례 데이터 갱신 때 테스트를 고치지 않습니다. 2022년 전국 168,645명처럼 특정 연도의 외부 교차검증 값만 리터럴로 둡니다.

## 코드 규칙

전체 규칙과 금지 사항은 [CLAUDE.md](CLAUDE.md)에 있습니다. 핵심만 요약하면:

| 영역 | 규칙 |
|---|---|
| 결측 | `null` ≠ `0`. 결측을 0으로 대체하지 않는다 |
| 조인 | 지역명이 아니라 `regionCode`로 조인한다 (강원도→강원특별자치도 등 개칭) |
| 문자열 | 화면 문구는 `src/content/ko.ts`를 거친다. JSX에 한글 리터럴 금지 |
| 연도 | 연도 배열·비교를 리터럴로 두지 않는다. 원자료·스냅숏에서 파생한다 |
| 셀렉터 | 순수 함수. UI 없이 단독 테스트할 수 있어야 한다 |
| 숫자 | 저장은 소수 4자리, 표시는 1자리 |
| 시각화 | SVG만 쓴다 (Canvas는 접근성 요구와 충돌) |
| 비밀 | 키를 파일·로그·커밋에 남기지 않는다. 로그는 `redact()`를 거친다 |
| 데이터 | 스냅숏은 `pnpm data:*` 파이프라인으로만 만든다. 검증 실패 데이터로 갱신하지 않는다 |

## 윤리 요구사항

"나중에 문구 추가"가 아니라 **검증 대상**입니다 ([PRD §5](docs/product-requirements.md)).

- 높은 비율에 경고색을 쓰지 않는다 (문제 함의 금지)
- "전국 평균"이 아니라 **"전국 값"** 이다 (17개 시도의 산술평균이 아님)
- 순위가 교육의 우열이 아님을 표시한다
- 결측 지역은 팔레트 최저색이 아니라 **사선 패턴**
- 다문화학생을 결손집단으로 표현하지 않는다

## 커밋과 PR

커밋 메시지는 한국어 접두사로 시작합니다.

| 접두사 | 용도 |
|---|---|
| `추가:` | 새 기능·파일 |
| `수정:` | 결함 수정 |
| `개선:` | 기존 동작 개선·리팩터 |
| `정비:` | 의존성·설정·문서 정리 |
| `갱신:` | 데이터 갱신 |

PR은 작게 나누고, 본문에 무엇을 왜 바꿨는지와 검증 방법을 적어 주세요. PR 템플릿의 체크리스트를 확인해 주세요.
