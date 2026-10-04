import { z } from 'zod';
import { multiculturalStudentStatSchema } from './multicultural-student';
import { multiculturalStudentTypeSchema, schoolLevelSchema } from './dimensions';

export const snapshotCoverageSchema = z
  .object({
    years: z.array(z.number().int().min(2016)).min(1),
    regionCount: z.number().int().nonnegative(),
    schoolLevels: z.array(schoolLevelSchema).min(1),
    studentTypes: z.array(multiculturalStudentTypeSchema).min(1),
    // 전국 학교급별 장기 시계열(e-나라 F008402)의 수록 연도. 시도별(years)보다 길다.
    nationwideYears: z.array(z.number().int().min(2016)).default([]),
  })
  .strict();

export const SnapshotCoverageSchema = snapshotCoverageSchema;
export type SnapshotCoverage = z.infer<typeof snapshotCoverageSchema>;

export const snapshotSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    retrievedAt: z.string().datetime({ offset: true }),
    coverage: snapshotCoverageSchema,
    rateFormula: z.string().min(1),
    records: z.array(multiculturalStudentStatSchema),
    // 전국(KR) 학교급별 장기 시계열. records 의 전국 레코드와 겹치는 연도는 값이 같아야 한다(V11).
    nationwide: z.array(multiculturalStudentStatSchema).default([]),
  })
  .strict();

export const SnapshotSchema = snapshotSchema;
export type Snapshot = z.infer<typeof snapshotSchema>;

export function parseSnapshot(raw: unknown): Snapshot {
  const result = snapshotSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .slice(0, 6)
    .map(({ path, message }) => `${path.length > 0 ? path.join('.') : 'snapshot'}: ${message}`)
    .join('; ');
  const remaining = result.error.issues.length - 6;
  throw new Error(
    `스냅숏 검증 실패: ${details}${remaining > 0 ? ` 외 ${remaining}건의 오류가 있습니다.` : ''}`,
  );
}
