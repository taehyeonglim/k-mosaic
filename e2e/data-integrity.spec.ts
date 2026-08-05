import { expect, test } from '@playwright/test';

import { gotoDashboard } from './helpers';

test.describe('r4-e2e 결측·윤리 표현 검증', () => {
  test('결측 지역은 0이 아니라 —와 데이터 없음으로 표시된다', async ({ page }) => {
    await gotoDashboard(page);

    const schoolLevelSelect = page.locator('#filter-school-level');
    await schoolLevelSelect.selectOption('other');
    await expect(schoolLevelSelect).toHaveValue('other');
    await expect(
      page.getByText('각종학교: 각종학교는 모수가 작아 비율이 크게 요동칠 수 있습니다.', {
        exact: true,
      }),
    ).toBeVisible();

    const mapLabels = await page
      .locator('path[role="button"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''));
    expect(mapLabels.filter((label) => label.includes('데이터 없음')).length).toBeGreaterThan(0);
    expect(await page.getByText('—', { exact: true }).count()).toBeGreaterThan(0);
    expect(
      await page.getByRole('heading', { name: '데이터 없음', exact: true }).count(),
    ).toBeGreaterThan(0);
  });

  test('순위 해석 주의·학생 유형 미제공 안내가 보이고 전국 평균 문구는 없다', async ({ page }) => {
    await gotoDashboard(page);

    await expect(
      page.getByText('순위는 교육의 우열이나 지역의 좋고 나쁨을 의미하지 않습니다.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        '이 통계는 학생 유형별(국내출생·중도입국·외국인가정) 구분을 제공하지 않습니다.',
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('전국 평균');
    expect(bodyText).toContain('전국 값');
  });

  test('2022년 전국 다문화학생 수가 168,645명으로 표시된다', async ({ page }) => {
    await gotoDashboard(page);

    await page.locator('#filter-year').selectOption('2022');
    await expect(page.locator('#filter-year')).toHaveValue('2022');
    await expect(page.locator('[data-key="student-count"]')).toContainText('168,645명');
  });

  // 표시 정밀도는 소수 1자리로 통일한다 (docs/decision-log.md DL-007).
  // 공표치 4%(정수 반올림) 대신 직접 계산값을 쓴다는 점이 핵심이므로,
  // 화면에서는 4.0% 를 확인하고 전체 정밀도(4.0238%)는 원자료에서 확인한다.
  test('2025년 전국 비율이 직접 계산값 4.0%로 표시된다', async ({ page }) => {
    await gotoDashboard(page);

    await expect(
      page
        .getByRole('region', { name: '전국 개요', exact: true })
        .getByText('4.0%', { exact: true }),
    ).toBeVisible();
  });

  test('스냅숏은 표시 정밀도보다 정밀한 계산값을 보존한다', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { resolve, dirname } = await import('node:path');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const snapshot = JSON.parse(
      readFileSync(resolve(root, 'data/snapshots/multicultural-students.v1.json'), 'utf8'),
    ) as {
      records: {
        year: number;
        regionCode: string;
        schoolLevel: string;
        multiculturalStudentRateComputed: number | null;
        multiculturalStudentRatePublished: number | null;
      }[];
    };
    const record = snapshot.records.find(
      (item) => item.year === 2025 && item.regionCode === 'KR' && item.schoolLevel === 'all',
    );
    expect(record).toBeDefined();
    // 공표치는 정수(4%)로 반올림돼 있다. 직접 계산값은 소수 4자리를 보존해야 한다.
    expect(record?.multiculturalStudentRatePublished).toBe(4);
    expect(record?.multiculturalStudentRateComputed).toBeCloseTo(4.0238, 4);
  });
});
