import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { redact } from './lib/redact.js';
import { runFetchMulticulturalStats } from './fetch-multicultural-stats.js';
import { runFetchTotalStudents } from './fetch-total-students.js';
import { runNormalizeStats } from './normalize-stats.js';
import { runValidateStats } from './validate-stats.js';
import { runBuildPublicDataset } from './build-public-dataset.js';
import { runFetchForeignStudents } from './fetch-foreign-students.js';
import { runBuildForeignDataset } from './build-foreign-dataset.js';

export async function runRefreshData(): Promise<void> {
  await runFetchMulticulturalStats();
  await runFetchTotalStudents();
  const normalized = runNormalizeStats();
  runValidateStats(normalized);
  const built = runBuildPublicDataset();
  await runFetchForeignStudents();
  const foreign = runBuildForeignDataset();
  const national2022 = built.records.find(
    (record) =>
      record.year === 2022 &&
      record.regionCode === 'KR' &&
      record.schoolLevel === 'all' &&
      record.studentType === 'total',
  );
  console.log(
    redact(
      `data:refresh 완료: 레코드 ${built.records.length}개, 검증 통과, 2022년 전국값 ${national2022?.multiculturalStudentCount ?? '결측'}명`,
    ),
  );
  const foreignLatestYear = Math.max(...foreign.coverage.years);
  const foreignNationalLatest = foreign.records.find(
    (record) => record.year === foreignLatestYear && record.regionCode === 'KR',
  );
  console.log(
    redact(
      `외국인 학생 데이터셋 완료: ${foreignLatestYear}년 전국 외국인 ${foreignNationalLatest?.foreignStudentCount ?? '결측'}명, 재적 ${foreignNationalLatest?.enrolledStudentCount ?? '결측'}명`,
    ),
  );
  console.log(redact('산출 경로: data/snapshots'));
}

async function main(): Promise<void> {
  await runRefreshData();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`data:refresh 실패: ${message}`));
    process.exitCode = 1;
  });
}
