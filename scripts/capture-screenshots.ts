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
  // 테마 전환 색상 transition(150ms)과 차트 그리기가 끝난 뒤 찍는다.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(1200);
}

/** 지도+순위 격자를 지도 카드 높이로 자른다 (두 패널 중 긴 쪽에 맞추지 않는다). */
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

interface Coverage {
  /** 시도별·전국 장기 수록 시작 연도 — 카드 문구에 리터럴로 쓰지 않는다. */
  regionalStart: number;
  nationwideStart: number;
}

function coverage(): Coverage {
  const snapshot = JSON.parse(
    readFileSync(resolve(ROOT, 'data/snapshots/multicultural-students.v1.json'), 'utf8'),
  ) as { coverage: { years: number[]; nationwideYears: number[] } };
  return {
    regionalStart: Math.min(...snapshot.coverage.years),
    nationwideStart: Math.min(...snapshot.coverage.nationwideYears),
  };
}

// 공유 카드(Open Graph) 1200×630 — 실제 화면의 히어로(잉크 띠)를 그대로 찍는다.
// 따로 조판한 카드가 아니라서 수치·색·타일이 사이트와 어긋날 수 없다.
// 1280×672 로 그려 0.9375배로 줄이면 1200×630 이다 (같은 비율, xl 배치 유지).
const OG_VIEWPORT = { width: 1280, height: 672 };
const OG_SCALE = 1200 / OG_VIEWPORT.width;

async function captureOgCard(page: Page, baseUrl: string, path: string): Promise<void> {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const { regionalStart, nationwideStart } = coverage();
  // 그림에서는 쓸 수 없는 조작 요소(메뉴·테마 전환·링크)를 숨기고 출처를 적는다.
  await page.addStyleTag({
    content: `
      .fixed, header nav, header dl, header [role='group'], #overview a { display: none !important; }
      .ink-band { height: ${OG_VIEWPORT.height}px; overflow: hidden; }
    `,
  });
  await page.evaluate(
    ({ source, caption }) => {
      const overview = document.querySelector('#overview');
      const line = document.createElement('p');
      line.textContent = source;
      line.style.cssText =
        'margin-top: 0.75rem; font-size: 0.8125rem; color: var(--km-color-text-muted);';
      overview?.append(line);
      const mosaicCaption = document.querySelector('.ink-band nav:not(header nav) > p');
      if (mosaicCaption !== null) mosaicCaption.textContent = caption;
    },
    {
      source: `출처: 교육부·한국교육개발원 「교육기본통계」 · 17개 시·도 ${regionalStart}년~ · 전국 ${nationwideStart}년~`,
      caption: '17개 시·도 · 학생 수',
    },
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.screenshot({
    path,
    clip: { x: 0, y: 0, width: OG_VIEWPORT.width, height: OG_VIEWPORT.height },
  });
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
        // README 첫 그림 — 히어로(잉크 띠)와 필터까지. 지도 중간에서 잘리지 않게 필터 아래에서 끊는다.
        await open(desktop, baseUrl, '/', theme);
        const filters = await desktop.locator('#filters').boundingBox();
        if (filters === null) throw new Error('필터 영역을 찾지 못했습니다.');
        await desktop.screenshot({
          path: resolve(IMAGES_DIR, `dashboard-hero-${theme}.png`),
          clip: { x: 0, y: 0, width: 1440, height: Math.ceil(filters.y + filters.height + 28) },
        });
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

      const og = await browser.newPage({ viewport: OG_VIEWPORT, deviceScaleFactor: OG_SCALE });
      await captureOgCard(og, baseUrl, OG_PATH);
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
