import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';

// README·공유 카드용 이미지를 빌드 산출물(out/)에서 다시 만든다.
//   pnpm docs:screenshots   (= pnpm build && tsx scripts/capture-screenshots.ts)
//
// e2e/screenshots/ 는 테스트 실행마다 바뀌는 산출물이라 커밋하지 않는다. 문서에 쓰는
// 이미지는 여기서 만들어 docs/images/ 에 커밋한다 — 연례 데이터 갱신 후 다시 실행한다.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES_DIR = resolve(ROOT, 'docs/images');
const OG_PATH = resolve(ROOT, 'public/og.png');

/** 고정 포트는 이전 실행이 남긴 서버와 충돌할 수 있어 빈 포트를 고른다. */
async function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === 'object' && address !== null
          ? done(address.port)
          : fail(new Error('빈 포트를 찾지 못했습니다.')),
      );
    });
  });
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // 정적 서버 기동 대기
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  throw new Error(`정적 서버가 응답하지 않습니다: ${url}`);
}

async function open(
  page: Page,
  baseUrl: string,
  path: string,
  theme: 'light' | 'dark',
): Promise<void> {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: theme, exact: true }).click();
  // 화면 밖에 고정 배치된 건너뛰기 링크가 요소 캡처에 섞이지 않게 숨기고,
  // 테마 버튼 위에 남은 마우스가 툴팁을 띄우지 않게 치운다.
  await page.addStyleTag({ content: '.fixed { display: none !important; }' });
  await page.mouse.move(0, 0);
  // 테마 전환 색상 transition(150ms)이 끝난 뒤 찍는다.
  await page.waitForTimeout(400);
}

/** 지도+순위 격자를 지도 카드 높이로 자른다 — 순위 표 4개까지 담으면 지나치게 길다. */
async function captureMapRow(page: Page, path: string): Promise<void> {
  const row = page.locator('#filters + div');
  await row.evaluate((element) =>
    window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY),
  );
  const rowBox = await row.boundingBox();
  const mapBox = await row.locator(':scope > *').first().boundingBox();
  if (rowBox === null || mapBox === null) throw new Error('지도 영역을 찾지 못했습니다.');
  await page.screenshot({
    path,
    clip: { x: rowBox.x, y: rowBox.y, width: rowBox.width, height: mapBox.height },
  });
}

interface OgFacts {
  year: number;
  count: string;
  rate: string;
  /** 시도별·전국 장기 수록 시작 연도 — 카드 문구에 리터럴로 쓰지 않는다. */
  regionalStart: number;
  nationwideStart: number;
}

function latestNationalFacts(): OgFacts {
  const snapshot = JSON.parse(
    readFileSync(resolve(ROOT, 'data/snapshots/multicultural-students.v1.json'), 'utf8'),
  ) as {
    coverage: { years: number[]; nationwideYears: number[] };
    records: {
      year: number;
      regionCode: string;
      schoolLevel: string;
      multiculturalStudentCount: number | null;
      multiculturalStudentRateComputed: number | null;
    }[];
  };
  const year = Math.max(...snapshot.coverage.years);
  const national = snapshot.records.find(
    (record) => record.year === year && record.regionCode === 'KR' && record.schoolLevel === 'all',
  );
  if (
    national?.multiculturalStudentCount == null ||
    national.multiculturalStudentRateComputed == null
  )
    throw new Error(`${year}년 전국 값이 없습니다.`);
  return {
    year,
    count: new Intl.NumberFormat('ko-KR').format(national.multiculturalStudentCount),
    rate: national.multiculturalStudentRateComputed.toFixed(1),
    regionalStart: Math.min(...snapshot.coverage.years),
    nationwideStart: Math.min(...snapshot.coverage.nationwideYears),
  };
}

/** 공유 카드: 핵심 수치 + 실제 단계구분도. 수치는 스냅숏에서 읽는다(갱신 후 재생성). */
function ogHtml(facts: OgFacts, mapPng: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
    * { margin: 0; box-sizing: border-box; }
    body { width: 1200px; height: 630px; background: #f6f9fa; color: #13262e;
      font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif; }
    .card { display: grid; grid-template-columns: 1fr 520px; height: 100%; padding: 64px 72px; gap: 32px; }
    .brand { font-size: 64px; font-weight: 800; letter-spacing: 0.04em; }
    .sub { margin-top: 12px; font-size: 26px; color: #3d5560; }
    .facts { margin-top: 56px; display: flex; gap: 48px; }
    .label { font-size: 20px; color: #4f6670; }
    .value { margin-top: 6px; font-size: 56px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .source { position: absolute; bottom: 48px; left: 72px; font-size: 18px; color: #4f6670; }
    .map { display: flex; align-items: center; justify-content: center; }
    .map img { max-width: 100%; max-height: 500px; }
  </style></head><body><div class="card">
    <div>
      <div class="brand">K-MOSAIC</div>
      <div class="sub">대한민국 다문화학생 교육통계 탐색기</div>
      <div class="facts">
        <div><div class="label">${facts.year}년 전국 다문화학생</div><div class="value">${facts.count}명</div></div>
        <div><div class="label">전체 학생 대비</div><div class="value">${facts.rate}%</div></div>
      </div>
    </div>
    <div class="map"><img src="data:image/png;base64,${mapPng}" alt=""></div>
  </div>
  <div class="source">출처: 교육부·한국교육개발원 「교육기본통계」 · 17개 시·도 ${facts.regionalStart}년~ · 전국 ${facts.nationwideStart}년~</div>
  </body></html>`;
}

async function main(): Promise<void> {
  mkdirSync(IMAGES_DIR, { recursive: true });
  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  const server = spawn(resolve(ROOT, 'node_modules/.bin/serve'), ['out', '-l', String(port)], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  try {
    await waitForServer(baseUrl);
    const browser = await chromium.launch();
    try {
      // xl(1280px) 이상에서 지도와 순위가 나란히 놓인다.
      const desktop = await browser.newPage({
        viewport: { width: 1440, height: 1300 },
        // README 는 약 880px 폭으로 표시된다. 1.25배(1800px)면 고해상도 화면에도 충분하고,
        // 연례 갱신마다 이력에 쌓이는 용량을 줄인다.
        deviceScaleFactor: 1.25,
      });
      for (const theme of ['light', 'dark'] as const) {
        await open(desktop, baseUrl, '/?regions=41,11', theme);
        await captureMapRow(desktop, resolve(IMAGES_DIR, `dashboard-map-${theme}.png`));
        // 섹션은 옆 칸 높이로 늘어나므로 안쪽 카드만 찍는다.
        await desktop
          .locator('#trend > *')
          .first()
          .screenshot({ path: resolve(IMAGES_DIR, `dashboard-trend-${theme}.png`) });
        await open(desktop, baseUrl, '/foreign-students/?regions=11,26', theme);
        await desktop
          .locator('#foreign-map')
          .locator('xpath=..')
          .screenshot({ path: resolve(IMAGES_DIR, `foreign-students-${theme}.png`) });
      }

      const mobile = await browser.newPage({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      });
      await open(mobile, baseUrl, '/', 'light');
      await mobile.screenshot({ path: resolve(IMAGES_DIR, 'mobile-light.png') });

      // 공유 카드(Open Graph) 1200×630 — 라이트 테마 지도를 잘라 카드에 넣는다.
      await open(desktop, baseUrl, '/', 'light');
      const map = await desktop.locator('svg[role="group"]').first().screenshot();
      const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
      await og.setContent(ogHtml(latestNationalFacts(), map.toString('base64')));
      await og.screenshot({ path: OG_PATH });
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
  console.log('스크린숏 저장: docs/images/, public/og.png');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
