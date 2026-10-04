import type { SourcePanelSource } from '@/components/dashboard/SourcePanel';
import { ko } from '@/content/ko';
import type { SourceMeta } from '../schema/index';
import { selectSourceMeta } from './selectors';

// 다문화학생 출처 패널용 변환 — 메인·출처 페이지가 같은 함수를 쓴다 (예전엔 두 벌).

export function formattedDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}

function roleLabel(role: SourceMeta['role']): string {
  if (role === 'numerator') return ko.sources.numeratorProvider;
  if (role === 'reference') return ko.sources.referenceProvider;
  return ko.sources.denominatorProvider;
}

export function multiculturalSourcePanelSources(): SourcePanelSource[] {
  return selectSourceMeta('multicultural').map((source) => ({
    role: roleLabel(source.role),
    provider: source.provider,
    organization: source.organization,
    statisticsName: source.statisticsName,
    tableId: source.tableId,
    tableName: source.tableName,
    sourceUrl: source.sourceUrl,
    retrievedAt: formattedDate(source.retrievedAt),
    referenceDate: source.referenceDate,
    isProvisional: source.isProvisional,
  }));
}
