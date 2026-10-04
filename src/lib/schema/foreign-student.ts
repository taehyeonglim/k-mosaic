import { z } from 'zod';
import { regionScopeSchema } from './dimensions';

export const foreignStudentStatSchema = z
  .object({
    year: z.number().int().min(2022),
    regionCode: regionScopeSchema,
    regionNameKo: z.string().min(1),
    regionNameEn: z.string().min(1),
    foreignStudentCount: z.number().finite().nonnegative().nullable(),
    enrolledStudentCount: z.number().finite().nonnegative().nullable(),
    foreignStudentRateComputed: z.number().finite().min(0).max(100).nullable(),
    notes: z.array(z.string()),
    // 인접 연도와 시도별 값이 전부 같은 구간이면 그 다른 연도 (DL-009). 없으면 null.
    // 이 필드 도입 전 스냅숏도 읽을 수 있게 기본값을 둔다.
    sourceDuplicateOf: z.number().int().nullable().default(null),
  })
  .strict();

export const ForeignStudentStatSchema = foreignStudentStatSchema;
export type ForeignStudentStat = z.infer<typeof foreignStudentStatSchema>;

export const foreignNationwideStatSchema = z
  .object({
    year: z.number().int().min(2018),
    scope: z.literal('nationwide'),
    degreeAndTraining: z.number().finite().nonnegative().nullable(),
    degreeOnly: z.number().finite().nonnegative().nullable(),
  })
  .strict();

export const ForeignNationwideStatSchema = foreignNationwideStatSchema;
export type ForeignNationwideStat = z.infer<typeof foreignNationwideStatSchema>;

export const foreignSnapshotCoverageSchema = z
  .object({
    years: z.array(z.number().int().min(2022)).min(1),
    nationwideYears: z.array(z.number().int().min(2018)).min(1),
    regionCount: z.number().int().nonnegative(),
  })
  .strict();

export const ForeignSnapshotCoverageSchema = foreignSnapshotCoverageSchema;
export type ForeignSnapshotCoverage = z.infer<typeof foreignSnapshotCoverageSchema>;

export const foreignSnapshotSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    retrievedAt: z.string().datetime({ offset: true }),
    coverage: foreignSnapshotCoverageSchema,
    rateFormula: z.string().min(1),
    records: z.array(foreignStudentStatSchema),
    nationwide: z.array(foreignNationwideStatSchema),
  })
  .strict();

export const ForeignSnapshotSchema = foreignSnapshotSchema;
export type ForeignSnapshot = z.infer<typeof foreignSnapshotSchema>;

export function parseForeignSnapshot(raw: unknown): ForeignSnapshot {
  const result = foreignSnapshotSchema.safeParse(raw);
  if (result.success) return result.data;

  const details = result.error.issues
    .slice(0, 6)
    .map(({ path, message }) => `${path.length > 0 ? path.join('.') : 'snapshot'}: ${message}`)
    .join('; ');
  const remaining = result.error.issues.length - 6;
  throw new Error(
    `외국인 학생 스냅숏 검증 실패: ${details}${remaining > 0 ? ` 외 ${remaining}건의 오류가 있습니다.` : ''}`,
  );
}
