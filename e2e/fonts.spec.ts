import { expect, test } from '@playwright/test';

// 서체 로딩 계약. 예전에는 글꼴 스택에 Pretendard 이름만 있고 파일을 불러오지 않아
// 방문자 기기의 기본 글꼴로 보였다 (2026-10 디자인 감사).

// 실측(2026-10): 페이지당 12~13개 파일, 295~322KB. 여유를 두고 450KB 로 잡는다.
const FONT_BUDGET_BYTES = 450 * 1024;

test.describe('서체 로딩', () => {
  test('Pretendard 가 자체 호스팅 파일로 실제 적용된다', async ({ page }) => {
    const fontUrls: string[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() === 'font') fontUrls.push(response.url());
    });
    await page.goto('/', { waitUntil: 'networkidle' });

    const applied = await page.evaluate(async () => {
      await document.fonts.ready;
      const loaded = [...document.fonts].filter(
        (face) => face.family.includes('Pretendard Variable') && face.status === 'loaded',
      ).length;
      return { loaded, family: getComputedStyle(document.body).fontFamily };
    });

    expect(applied.family).toMatch(/^"?Pretendard Variable/);
    expect(applied.loaded).toBeGreaterThan(0);
    expect(fontUrls.length).toBeGreaterThan(0);
    // 외부 CDN 이 아니라 같은 출처에서 받는다 (런타임 외부 요청 없음 원칙).
    for (const url of fontUrls) expect(new URL(url).origin).toBe(new URL(page.url()).origin);
  });

  test('첫 방문의 폰트 전송량이 예산 안이다', async ({ page }) => {
    let bytes = 0;
    const pending: Promise<void>[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'font') return;
      pending.push(
        response.body().then(
          (body) => {
            bytes += body.byteLength;
          },
          () => undefined,
        ),
      );
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await Promise.all(pending);

    expect(bytes).toBeGreaterThan(0);
    expect(bytes, `폰트 전송량 ${Math.round(bytes / 1024)}KB`).toBeLessThanOrEqual(
      FONT_BUDGET_BYTES,
    );
  });

  test('글꼴 교체로 화면이 밀리지 않는다 (layout shift 0.1 미만)', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        })[]) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForTimeout(300);

    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls, `layout shift 합계 ${cls.toFixed(4)}`).toBeLessThan(0.1);
  });
});
