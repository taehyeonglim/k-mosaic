import { z } from 'zod';
import { multiculturalStudentStatSchema } from './multicultural-student';
import { multiculturalStudentTypeSchema, schoolLevelSchema } from './dimensions';

export const snapshotCoverageSchema = z
  .object({
    years: z.array(z.number().int().min(2016)).min(1),
    regionCount: z.number().int().nonnegative(),
    schoolLevels: z.array(schoolLevelSchema).min(1),
    studentTypes: z.array(multiculturalStudentTypeSchema).min(1),
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
