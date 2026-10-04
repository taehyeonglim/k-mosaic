import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, type Page } from '@playwright/test';

export const SCREENSHOTS_DIR = resolve(process.cwd(), 'e2e/screenshots');

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

export async function gotoDashboard(page: Page): Promise<void> {
  const response = await page.goto('/', { waitUntil: 'networkidle' });
  if (response === null || !response.ok()) {
    throw new Error('대시보드 정적 문서를 불러오지 못했습니다.');
  }
  await expect(page.getByRole('heading', { name: '전국 개요', exact: true })).toBeVisible();
  await expect(page.locator('path[role="button"]')).toHaveCount(17);
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > window.innerWidth ||
      document.body.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
}

/**
 * 실제 KOSIS 키 — 환경변수 또는 .env.local. 없으면 null.
 * CI·새 clone 에는 키가 없다(배포에 키가 필요 없도록 설계). 키가 없을 때 E2E 가 실패하면
 * CI 에서 E2E 를 돌릴 수 없으므로, 호출부는 null 이면 패턴 검사만 한다.
 */
export function readApiKeyIfAvailable(): string | null {
  const fromEnv = process.env.KOSIS_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return null;
  const line = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith('KOSIS_API_KEY='));
  const rawValue = line?.slice('KOSIS_API_KEY='.length).trim() ?? '';
  if (rawValue.length === 0) return null;
  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }
  return rawValue;
}

/** 키 값을 몰라도 잡을 수 있는 노출 흔적 — KOSIS 인증 파라미터에 값이 실린 경우. */
export function containsApiKeyParameter(values: readonly string[]): boolean {
  return values.some((value) => /[?&]apiKey=[^&\s"']+/i.test(value));
}

export function containsSecret(values: readonly string[], secret: string): boolean {
  return values.some(
    (value) => value.includes(secret) || value.includes(encodeURIComponent(secret)),
  );
}

export interface SnapshotFacts {
  years: number[];
  latestYear: number;
  /** 최신 연도 전국·전체 학교급 다문화학생 수 — 화면 표기(예: 202,208명) */
  latestNationalCountLabel: string;
  /** 스냅숏 조회일 — 헤더 '갱신일' 표기(예: 2026. 8. 5.) */
  retrievedAtLabel: string;
}

/**
 * 기대값을 커밋된 스냅숏에서 파생한다. 최신 연도·수치·갱신일을 리터럴로 적으면
 * 연례 데이터 갱신 때마다 테스트가 깨진다. 특정 연도의 외부 교차검증 값
 * (예: 2022년 168,645명)은 갱신과 무관한 사실이므로 리터럴로 둔다.
 */
export function readSnapshotFacts(): SnapshotFacts {
  const snapshot = JSON.parse(
    readFileSync(resolve(process.cwd(), 'data/snapshots/multicultural-students.v1.json'), 'utf8'),
  ) as {
    retrievedAt: string;
    coverage: { years: number[] };
    records: {
      year: number;
      regionCode: string;
      schoolLevel: string;
      multiculturalStudentCount: number | null;
    }[];
  };
  const years = [...snapshot.coverage.years].sort((left, right) => left - right);
  const latestYear = years[years.length - 1];
  if (latestYear === undefined) throw new Error('스냅숏 수록 연도가 비어 있습니다.');
  const national = snapshot.records.find(
    (record) =>
      record.year === latestYear && record.regionCode === 'KR' && record.schoolLevel === 'all',
  );
  if (national?.multiculturalStudentCount == null) {
    throw new Error(`스냅숏에 ${latestYear}년 전국 값이 없습니다.`);
  }
  return {
    years,
    latestYear,
    latestNationalCountLabel: `${new Intl.NumberFormat('ko-KR').format(national.multiculturalStudentCount)}명`,
    retrievedAtLabel: new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeZone: 'Asia/Seoul',
    }).format(new Date(snapshot.retrievedAt)),
  };
}
