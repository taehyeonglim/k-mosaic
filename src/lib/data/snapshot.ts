import rawSnapshot from '../../../data/snapshots/multicultural-students.v1.json';
import rawSourceMeta from '../../../data/metadata/sources.v1.json';
import {
  parseSnapshot,
  SourceMetaSchema,
  type Snapshot,
  type SourceMeta,
} from '../schema/index';

function indexKey(year: number, regionCode: string, schoolLevel: string): string {
  return `${year}|${regionCode}|${schoolLevel}`;
}

const SNAPSHOT: Snapshot = parseSnapshot(rawSnapshot);

/** The web layer reads this immutable-by-convention index exactly once at module load. */
export const snapshotIndex = new Map(
  SNAPSHOT.records.map((record) => {
    const key = indexKey(record.year, record.regionCode, record.schoolLevel);
    return [key, record] as const;
  }),
);

if (snapshotIndex.size !== SNAPSHOT.records.length) {
  throw new Error('스냅숏 인덱스 복합키가 중복됩니다.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseSourceEntry(value: unknown, fallbackRetrievedAt: string): SourceMeta | null {
  if (!isRecord(value)) return null;
  const candidate = {
    role: value.role,
    provider: value.provider,
    organization: value.organization,
    statisticsName: value.statisticsName,
    tableId: value.tableId ?? value.tableCode ?? value.tblId,
    tableName: value.tableName ?? value.tableNameKo ?? value.nameKo,
    accessMethod:
      value.accessMethod === 'HTML 파싱 (OpenAPI 미제공)' ? 'html-parse' : value.accessMethod,
    sourceUrl:
      value.sourceUrl ?? value.url ?? 'https://kosis.kr/openapi/Param/statisticsParameterData.do',
    retrievedAt: value.retrievedAt ?? fallbackRetrievedAt,
    lastChangedAt: value.lastChangedAt ?? null,
    referenceDate: value.referenceDate ?? null,
    isProvisional: value.isProvisional ?? null,
  };
  const parsed = SourceMetaSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function loadSourceMeta(): SourceMeta[] {
  const raw: unknown = rawSourceMeta;
  const fallbackRetrievedAt = SNAPSHOT.retrievedAt;
  if (Array.isArray(raw)) {
    const parsed = raw
      .map((entry) => parseSourceEntry(entry, fallbackRetrievedAt))
      .filter((entry): entry is SourceMeta => entry !== null);
    if (parsed.length !== raw.length)
      throw new Error('출처 메타데이터 스키마 검증에 실패했습니다.');
    return parsed;
  }
  if (!isRecord(raw)) throw new Error('출처 메타데이터 형식이 올바르지 않습니다.');
  const rootRetrievedAt =
    typeof raw.retrievedAt === 'string' ? raw.retrievedAt : fallbackRetrievedAt;
  if (Array.isArray(raw.sources)) {
    const parsed = raw.sources
      .map((entry) => parseSourceEntry(entry, rootRetrievedAt))
      .filter((entry): entry is SourceMeta => entry !== null);
    if (parsed.length !== raw.sources.length)
      throw new Error('출처 메타데이터 스키마 검증에 실패했습니다.');
    return parsed;
  }

  const legacyEntries: unknown[] = [];
  if (isRecord(raw.numerator)) {
    legacyEntries.push({
      role: 'numerator',
      provider: raw.numerator.provider,
      organization: raw.numerator.originOrganization,
      statisticsName: '교육기본통계',
      tableId: raw.numerator.tableCode,
      tableName: raw.numerator.tableNameKo,
      accessMethod: 'html-parse',
      sourceUrl: raw.numerator.url,
      retrievedAt: rootRetrievedAt,
      lastChangedAt: null,
      referenceDate: null,
      isProvisional: null,
    });
  }
  if (isRecord(raw.denominator) && isRecord(raw.denominator.tables)) {
    for (const table of Object.values(raw.denominator.tables)) {
      if (!isRecord(table)) continue;
      legacyEntries.push({
        role: 'denominator',
        provider: 'KOSIS 국가통계포털 OpenAPI',
        organization: raw.denominator.orgNameKo ?? '한국교육개발원',
        statisticsName: raw.denominator.statisticsNameKo ?? '교육기본통계',
        tableId: table.tblId,
        tableName: table.nameKo,
        accessMethod: 'openapi',
        sourceUrl: 'https://kosis.kr/openapi/Param/statisticsParameterData.do',
        retrievedAt: rootRetrievedAt,
        lastChangedAt: null,
        referenceDate: null,
        isProvisional: null,
      });
    }
  }
  const parsed = legacyEntries
    .map((entry) => parseSourceEntry(entry, rootRetrievedAt))
    .filter((entry): entry is SourceMeta => entry !== null);
  if (parsed.length !== legacyEntries.length)
    throw new Error('출처 메타데이터 스키마 검증에 실패했습니다.');
  return parsed;
}

export const sourceMeta = loadSourceMeta();

export function loadSnapshot(): Snapshot {
  return SNAPSHOT;
}

export function snapshotKey(year: number, regionCode: string, schoolLevel: string): string {
  return indexKey(year, regionCode, schoolLevel);
}
