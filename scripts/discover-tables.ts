import { redact } from '../src/lib/mcp/index.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { DENOMINATOR_TABLES } from './fetch-total-students.js';

const DISCOVERED_TABLES = [
  {
    role: 'numerator',
    provider: 'e-나라지표',
    tableId: 'F008403',
    tableName: '시도별 다문화학생 수 및 다문화학생 비율',
    accessMethod: 'html-parse',
  },
  ...DENOMINATOR_TABLES.map((table) => ({
    role: 'denominator',
    provider: 'KOSIS',
    tableId: table.tblId,
    tableName: table.tableName,
    accessMethod: 'openapi',
  })),
] as const;

export function runDiscoverTables(): typeof DISCOVERED_TABLES {
  console.log(
    redact(
      `검증된 데이터 경로 ${DISCOVERED_TABLES.length}개를 사용합니다. KOSIS에서 분자를 재검색하지 않습니다.`,
    ),
  );
  for (const table of DISCOVERED_TABLES)
    console.log(redact(`${table.role}: ${table.tableId} — ${table.tableName}`));
  return DISCOVERED_TABLES;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  runDiscoverTables();
