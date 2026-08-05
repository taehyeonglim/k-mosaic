import { z } from 'zod';

const REGION_CODES = [
  '11',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '36',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '50',
] as const;

export const regionCodeSchema = z.enum(REGION_CODES);
export const RegionCodeSchema = regionCodeSchema;
export type RegionCode = z.infer<typeof regionCodeSchema>;

export const regionScopeSchema = z.union([regionCodeSchema, z.literal('KR')]);
export const RegionScopeSchema = regionScopeSchema;
export type RegionScope = z.infer<typeof regionScopeSchema>;

export const schoolLevelSchema = z.enum(['all', 'elementary', 'middle', 'high', 'other']);
export const SchoolLevelSchema = schoolLevelSchema;
export type SchoolLevel = z.infer<typeof schoolLevelSchema>;

export const multiculturalStudentTypeSchema = z.enum([
  'total',
  'domesticBorn',
  'midEntry',
  'foreignFamily',
  'unknown',
]);
export const MulticulturalStudentTypeSchema = multiculturalStudentTypeSchema;
export type MulticulturalStudentType = z.infer<typeof multiculturalStudentTypeSchema>;

export const metricKeySchema = z.enum(['count', 'rate']);
export const MetricKeySchema = metricKeySchema;
export type MetricKey = z.infer<typeof metricKeySchema>;

export const rankingMetricSchema = z.enum(['count', 'rate', 'deltaAbs', 'deltaPct']);
export const RankingMetricSchema = rankingMetricSchema;
export type RankingMetric = z.infer<typeof rankingMetricSchema>;
