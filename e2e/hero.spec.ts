import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { assertNoHorizontalOverflow, gotoDashboard, readSnapshotFacts } from './helpers';

// 히어로(전국 개요)와 17개 시·도 타일 모자이크.
// 기대값은 커밋된 스냅숏에서 파생한다 (연례 갱신 후에도 유효).

interface Stat {
  year: number;
  regionCode: string;
  schoolLevel: string;
  multiculturalStudentCount: number | null;
  multiculturalStudentRateComputed: number | null;
}

const snapshot = JSON.parse(
  readFileSync(resolve(process.cwd(), 'data/snapshots/multicultural-students.v1.json'), 'utf8'),
) as {
  coverage: { years: number[]; nationwideYears: number[] };
  records: Stat[];
  nationwide: Stat[];
};

const count = (value: number) => `${new Intl.NumberFormat('ko-KR').format(value)}명`;
const rate = (value: number) =>
  `${new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;

function stat(year: number, regionCode: string): Stat {
  const found = snapshot.records.find(
    (record) =>
      record.year === year && record.regionCode === regionCode && record.schoolLevel === 'all',
  );
  if (found === undefined) throw new Error(`스냅숏에 ${year}년 ${regionCode} 값이 없습니다.`);
  return found;
}

function mosaic(page: Page): Locator {
  return page.getByRole('navigation', { name: '시·도 모자이크', exact: true });
}

function tile(page: Page, code: string): Locator {
  return mosaic(page).locator(`a[href$="/regions/${code}/"]`);
}

test.describe('히어로', () => {
  test('정적 HTML 에 핵심 수치와 타일 링크가 들어 있다 (JS 없이도 읽힌다)', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const facts = readSnapshotFacts();

    expect(html).toContain(facts.latestNationalCountLabel.replace('명', ''));
    expect(html.match(/href="[^"]*\/regions\/\d{2}\/"/g) ?? []).toHaveLength(17);
  });

  test('장기 증감은 전국 장기 시계열의 첫 연도를 기준으로 한다', async ({ page }) => {
    await gotoDashboard(page);
    const facts = readSnapshotFacts();
    const baselineYear = Math.min(...snapshot.coverage.nationwideYears);
    const baseline = snapshot.nationwide.find(
      (record) => record.year === baselineYear && record.schoolLevel === 'all',
    )!.multiculturalStudentCount!;
    const latest = stat(facts.latestYear, 'KR').multiculturalStudentCount!;
    const tileLocator = page.locator('[data-key="first-year"]');

    await expect(tileLocator).toContainText(`${baselineYear}년 대비`);
    await expect(tileLocator).toContainText(`+${count(latest - baseline)}`);
  });

  test('전국 개요 제목 옆에 기준일을 적는다', async ({ page }) => {
    await gotoDashboard(page);
    const overview = page.getByRole('region', { name: '전국 개요', exact: true });

    await expect(overview).toContainText(`${readSnapshotFacts().latestYear}년 4월 1일 기준`);
    await page.locator('#filter-year').selectOption('2022');
    await expect(overview).toContainText('2022년 4월 1일 기준');
  });
});

test.describe('타일 모자이크', () => {
  test('17개 시·도 타일이 지리적 순서로 놓이고 지역 페이지로 이어진다', async ({ page }) => {
    await gotoDashboard(page);
    const facts = readSnapshotFacts();
    const links = mosaic(page).getByRole('link');

    await expect(links).toHaveCount(17);
    await expect(links.nth(0)).toContainText('인천');
    await expect(links.nth(1)).toContainText('서울');
    await expect(links.nth(3)).toContainText('강원');
    await expect(links.nth(16)).toContainText('제주');

    // 보이는 약칭이 접근 가능한 이름에 들어 있고, 이름에는 공식 명칭과 값이 있다.
    const seoulCount = count(stat(facts.latestYear, '11').multiculturalStudentCount!);
    await expect(tile(page, '11')).toHaveAccessibleName(
      new RegExp(`^서울\\s?특별시\\s+${seoulCount}$`),
    );
    await expect(tile(page, '48')).toHaveAccessibleName(/^경남\s+\(경상남도\)\s+/);

    await tile(page, '11').click();
    await expect(page).toHaveURL(/\/regions\/11\/$/);
    await expect(page.getByRole('heading', { name: '서울특별시 다문화학생' })).toBeVisible();
  });

  test('필터를 바꾸면 타일 값이 함께 바뀐다', async ({ page }) => {
    await gotoDashboard(page);

    await page.locator('#filter-year').selectOption('2022');
    await expect(tile(page, '11')).toContainText(
      count(stat(2022, '11').multiculturalStudentCount!),
    );

    await page.getByRole('button', { name: '비율', exact: true }).click();
    await expect(tile(page, '11')).toContainText(
      rate(stat(2022, '11').multiculturalStudentRateComputed!),
    );
  });

  test('결측 타일은 0 이나 가장 옅은 색이 아니라 사선 패턴과 — 로 표시한다', async ({ page }) => {
    const facts = readSnapshotFacts();
    const missing = snapshot.records.find(
      (record) =>
        record.year === facts.latestYear &&
        record.schoolLevel === 'all' &&
        record.regionCode !== 'KR' &&
        record.multiculturalStudentRateComputed === null,
    );
    test.skip(missing === undefined, '최신 연도에 비율 결측 지역이 없다');

    await page.goto('/?metric=rate', { waitUntil: 'networkidle' });
    const missingTile = tile(page, missing!.regionCode);

    await expect(missingTile).toHaveAttribute('data-missing', 'true');
    await expect(missingTile).toContainText('—');
    expect(
      await missingTile.evaluate((element) => getComputedStyle(element).backgroundImage),
    ).toContain('repeating-linear-gradient');
    await expect(mosaic(page).locator('a[data-missing="true"]').first()).toBeVisible();
  });

  test('360px 에서 17개 타일이 모두 보이고 가로로 넘치지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await gotoDashboard(page);

    const links = mosaic(page).getByRole('link');
    await expect(links).toHaveCount(17);
    for (const index of [0, 3, 16]) await expect(links.nth(index)).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('필터가 걸린 주소의 첫 화면', () => {
  test('스크립트가 뜨기 전에는 기본 필터의 수치를 보여 주지 않는다', async ({ page }) => {
    // 정적 HTML 은 기본 필터(최신 연도)의 화면이다. 주소에 다른 필터가 있으면
    // 클라이언트가 다시 그리기 전까지 가려 둔다 — 다른 연도의 수치가 잠깐 보이지 않게.
    // 스타일시트는 그대로 두고 스크립트 파일만 막는다 (문서 안의 인라인 스크립트는 실행된다).
    await page.route('**/_next/static/**', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    );

    await page.goto('/?year=2022', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-hero-fallback]')).toHaveCSS('visibility', 'hidden');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-hero-fallback]')).toHaveCSS('visibility', 'visible');
  });
});
