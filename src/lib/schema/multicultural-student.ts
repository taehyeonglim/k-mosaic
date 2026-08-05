import { z } from 'zod';
import { multiculturalStudentTypeSchema, regionScopeSchema, schoolLevelSchema } from './dimensions';

export const multiculturalStudentStatSchema = z
  .object({
    year: z.number().int().min(2016),
    regionCode: regionScopeSchema,
    regionNameKo: z.string().min(1),
    regionNameEn: z.string().min(1),
    schoolLevel: schoolLevelSchema,
    studentType: multiculturalStudentTypeSchema,
    multiculturalStudentCount: z.number().finite().nonnegative().nullable(),
    totalStudentCount: z.number().finite().nonnegative().nullable(),
    multiculturalStudentRateComputed: z.number().finite().min(0).max(100).nullable(),
    multiculturalStudentRatePublished: z.number().finite().min(0).max(100).nullable(),
    notes: z.array(z.string()),
  })
  .strict();

export const MulticulturalStudentStatSchema = multiculturalStudentStatSchema;
export type MulticulturalStudentStat = z.infer<typeof multiculturalStudentStatSchema>;
