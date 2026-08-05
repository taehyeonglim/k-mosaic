import { z } from 'zod';

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const sourceMetaSchema = z
  .object({
    role: z.enum(['numerator', 'denominator']),
    provider: z.string().min(1),
    organization: z.string().min(1),
    statisticsName: z.string().min(1),
    tableId: z.string().min(1),
    tableName: z.string().min(1),
    accessMethod: z.enum(['html-parse', 'openapi']),
    sourceUrl: z.string().url(),
    retrievedAt: isoDateTimeSchema,
    lastChangedAt: z.string().min(1).nullable(),
    referenceDate: z.string().min(1).nullable(),
    isProvisional: z.boolean().nullable(),
  })
  .strict();

export const SourceMetaSchema = sourceMetaSchema;
export const sourceRefSchema = sourceMetaSchema;
export const SourceRefSchema = sourceMetaSchema;
export type SourceMeta = z.infer<typeof sourceMetaSchema>;
export type SourceRef = SourceMeta;
