# 운영 가이드

K-MOSAIC을 유지·갱신·배포하는 절차입니다. 처음 개발 환경을 꾸리는 방법은 [CONTRIBUTING.md](../CONTRIBUTING.md)를 보세요.

| 작업 | API 키 | 주기 |
|---|---|---|
| 개발·빌드·테스트·배포 | ❌ 불필요 | 수시 |
| 업스트림 새 연도 감시 | ❌ 불필요 (e-나라지표만 조회) | 자동 (GitHub Actions) |
| **데이터 갱신** | ✅ `KOSIS_API_KEY` | 연 1회 |

웹 앱은 커밋된 스냅숏(`data/snapshots/`)만 읽습니다. 런타임에 외부 API를 호출하지 않으므로 배포 환경에는 키가 없습니다 ([ADR-001](adr/001-data-ingestion-architecture.md)).

---

## 1. 환경변수

키는 **데이터 갱신 스크립트에만** 필요합니다.

```bash
cp .env.example .env.local
# .env.local 을 열어 KOSIS_API_KEY 를 채운다
```

- 발급: [KOSIS OpenAPI](https://kosis.kr/openapi/) (무료, 즉시 발급)
- `.env.local` 외의 파일·로그·커밋에 키를 두지 않습니다. KOSIS는 쿼리스트링 인증이라 요청 URL을 출력하면 키가 노출됩니다 — 로그는 반드시 `redact()`를 거칩니다.
- `NEXT_PUBLIC_` 접두사를 붙이지 않습니다 (브라우저 번들에 들어갑니다).

---

## 2. 데이터 갱신 런북

교육기본통계는 **매년 4월 1일 기준**으로 조사되어 연 1회 공표됩니다.

### 2.1 언제 하나

| 시점 | 내용 |
|---|---|
| 8월 말 | 한국교육개발원 보도자료 (수치 확인용 — 이 시점엔 아직 API·지표에 없을 수 있음) |
| 10월 말~12월 | KOSIS 개황표·e-나라지표 반영 (2025년 기준: KOSIS 분모표 10-31, `DT_1963003_010_S` 12-17) |

**감시는 자동입니다.** [`upstream-watch.yml`](../.github/workflows/upstream-watch.yml)이 9~12월 매주, 그 외 매월 e-나라지표의 최신 연도를 스냅숏과 비교하고, 새 연도가 있으면 `data-refresh` 라벨 이슈를 엽니다. 수동 확인:

```bash
pnpm data:check-upstream
```

### 2.2 0단계 — 분모(KOSIS) 반영 확인

e-나라지표(분자)에 새 연도가 올라와도 KOSIS(분모)가 늦게 반영될 수 있습니다. 분모 없이 갱신하면 그 연도는 비율이 전부 결측이 됩니다.

- 검증 규칙 **V9(분모 연도 누락 금지)** 가 이 경우를 차단합니다. V9로 실패하면 KOSIS 반영을 기다렸다가 다시 실행하세요.
- 외국인 유학생 시도별 자료(`DT_1963003_010_S`)는 KOSIS에 새 연도가 없으면 그 연도를 수집하지 않습니다(이전 연도까지만 시도별로 표시).

### 2.3 실행

```bash
pnpm data:refresh
```

순서: 다문화 분자(e-나라 F008403) → 분모(KOSIS 4개 표) → 정규화 → 검증 → 공개 스냅숏 → 외국인 유학생 수집(KOSIS `010_S` + e-나라 153401) → 외국인 스냅숏.

단계별 실행:

```bash
pnpm data:fetch           # 다문화 분자 + 분모 수집 → data/raw/
pnpm data:normalize       # 정규화 → data/normalized/
pnpm data:validate        # 검증 게이트 (정규화본 + 공개 스냅숏)
pnpm data:build           # 공개 스냅숏·CSV + 출처 메타데이터(병합)
pnpm data:fetch-foreign   # 외국인 유학생 수집
pnpm data:build-foreign   # 외국인 스냅숏 (검증 포함)
pnpm data:validate-foreign
```

**자동으로 처리되는 것** (코드 수정 불필요):

- 수록 연도는 원자료에서 파생됩니다. 연도 배열을 고치지 마세요.
- e-나라 시도별 표는 최근 6개년만 제공합니다. 가장 오래된 연도가 빠지면 이전 공개 스냅숏에서 **보존**합니다 (로그: `업스트림 제공 범위 밖 연도 보존`).
- 공표 비율이 정수로 반올림된 연도(2025년 등)는 자료 모양으로 판별해 주석을 달고 V4 대조에서 제외합니다.
- 출처 기준일(`referenceDate`)은 최신 연도의 4월 1일로 갱신됩니다.

### 2.4 검토 체크리스트

검증을 통과해도 사람이 확인합니다. 데이터 변경은 사람의 확인을 거쳐야 합니다.

- [ ] 검증 결과에 `FAIL`이 없다. `WARN`은 내용을 읽었다 (X8 급증·급감은 소규모 각종학교에서 흔함, X12 2022=2023은 알려진 출처 사항)
- [ ] `git diff --stat data/` — 새 연도 레코드가 추가되고, 기존 연도가 사라지지 않았다
- [ ] 새 연도 전국 다문화학생 수가 한국교육개발원 보도자료와 일치한다
- [ ] 기존 연도 값이 바뀌었다면(업스트림 정정) 이유를 확인했다
- [ ] `data/metadata/sources.v1.json`에 출처 7건(다문화 5 + 외국인 2)이 모두 있다
- [ ] `pnpm test && pnpm test:e2e` 통과 (테스트 기대값은 스냅숏에서 파생되므로 수정 불필요)

### 2.5 함께 갱신할 문서·자산

코드와 테스트는 그대로 두되, 다음은 손으로 갱신합니다.

- [ ] `README.md`·`README.en.md`의 핵심 수치 (최신 연도 전국 학생 수·비율)
- [ ] `CITATION.cff`의 `version`·`date-released`
- [ ] README 스크린숏 (`docs/images/`)
- [ ] `CLAUDE.md` §6의 "기준 데이터" 날짜

### 2.6 커밋·배포

```bash
git switch -c data/YYYY-refresh
git add data/snapshots data/normalized data/metadata  # data/raw 는 커밋하지 않는다
git commit -m "갱신: YYYY년 교육기본통계 반영"
```

PR 본문에 검증 결과(PASS/WARN 목록)와 `git diff --stat data/`를 붙입니다. CI는 base 브랜치 스냅숏과 비교해 연도 커버리지 축소(V8·F5)를 다시 확인합니다. 머지하면 자동 배포됩니다.

### 2.7 검증이 실패하면

**스냅숏을 커밋하지 않습니다.** 검증된 옛 데이터가 오염된 새 데이터보다 낫습니다. build 스크립트는 검증을 통과하기 전에는 스냅숏·메타데이터를 쓰지 않습니다.

| 규칙 | 흔한 원인 | 대응 |
|---|---|---|
| V9 | KOSIS 분모 미반영 | 반영 후 재실행 |
| V2·X7·F2 | 시도 합 ≠ 전국 | 업스트림 정정 대기 또는 원자료 확인 |
| V8·F5 | 연도 축소 | 업스트림이 중간 연도를 뺐는지 확인 |
| X12 (block) | 2022=2023 외의 동일 연도 구간 | 출처 확인 후 화면 문구·주석 검토 |
| V4 | 계산 비율 ≠ 공표 비율 | 모수 정의 재검증: `pnpm data:verify-denominator` |

---

## 3. 배포

`main`에 머지하면 GitHub Pages로 자동 배포됩니다.

| 워크플로 | 시점 | 내용 |
|---|---|---|
| [`build.yml`](../.github/workflows/build.yml) | (재사용) | typecheck · lint · test · 데이터 검증 2종 · basePath 빌드 · 링크 검사 · 비밀정보 스캔 |
| [`ci.yml`](../.github/workflows/ci.yml) | PR | `build.yml` + E2E·axe (Playwright) |
| [`deploy.yml`](../.github/workflows/deploy.yml) | `main` 푸시 | `build.yml` → Pages 배포 |
| [`upstream-watch.yml`](../.github/workflows/upstream-watch.yml) | 주·월 정기 | 새 연도 공표 감시 → 이슈 |

### 최초 설정

1. 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 설정
2. `main`에 푸시

### 경로 접두사

프로젝트 페이지(`username.github.io/k-mosaic/`)는 경로 접두사가 필요합니다. 워크플로가 저장소 이름으로 주입합니다.

```yaml
env:
  NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}
```

- 사용자 페이지나 커스텀 도메인으로 바꾸면 이 값을 비우고, 커스텀 도메인은 `public/CNAME`을 추가합니다.
- 빌드 단계가 `out/.nojekyll`을 만듭니다. 없으면 Jekyll이 `_next/`를 무시해 CSS·JS가 404가 됩니다.
- 로컬 E2E는 basePath 없이 돌기 때문에, `<a href="/...">`처럼 basePath가 빠진 링크는 `build.yml`의 링크 검사가 잡습니다. 내부 링크는 `next/link`를 쓰세요.

### 다른 플랫폼

`out/`을 그대로 올리면 됩니다 (Vercel · Cloudflare Pages · Netlify). 이때 `NEXT_PUBLIC_BASE_PATH`는 비웁니다.

```bash
pnpm build    # 정적 내보내기 → out/
pnpm start    # out/ 로컬 서빙
```

`build` 스크립트는 `KOSIS_API_KEY=`를 앞에 붙여 실행합니다. Next.js가 `.env.local`을 자동 로드해 빌드 캐시에 키가 남는 것을 막기 위함입니다 ([architecture.md §5.5](architecture.md)).

---

## 4. 보안

- 키는 `.env.local`에만 있고 `.gitignore` 대상입니다. 정적 배포라 런타임에 키가 없습니다.
- **`.next/`를 캐시·업로드하지 마세요** — 빌드 캐시에 환경 스냅숏이 들어갈 수 있습니다.
- 비밀정보 검사 (추적 파일 · 빌드 산출물 · 테스트 리포트 · 로그):

```bash
npx tsx scripts/security/scan-secrets.ts
```

검사는 **바이트 단위 비교**로 합니다. 이 환경의 `grep`은 ugrep이라 바이너리 처리 의미론이 달라 실제 유출을 놓친 사례가 있습니다 ([architecture.md §5.5](architecture.md)). git 이력 전체는 검사하지 않으므로, 키를 커밋했다면 이력 재작성보다 **키 재발급**이 우선입니다.

키가 노출되었다면 [KOSIS OpenAPI 관리](https://kosis.kr/openapi/)에서 즉시 재발급하세요. 정적 배포라 재발급이 서비스에 영향을 주지 않습니다.

---

## 5. 탐색 도구

`korean-stats-mcp`는 **데이터 탐색 단계에서만** 씁니다. 런타임에는 호출하지 않습니다 ([DL-003](decision-log.md)).

```bash
pnpm mcp:inspect      # MCP 도구 목록·입력 스키마 (원격 https://mcp.gomdori.app/stats, 키 불필요)
pnpm data:discover    # 통계표 탐색
```

> ⚠️ **KOSIS OpenAPI에는 다문화학생 통계가 없습니다.** 6개 독립 경로로 확인했습니다 ([data-audit.md](data-audit.md)). 다시 검색하지 마세요.
