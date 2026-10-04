import { describe, expect, it } from 'vitest';

import { FOREIGN_TABLE_IDS, MULTICULTURAL_TABLE_IDS } from '@/lib/constants/sources';
import { selectSourceMeta } from '@/lib/data/selectors';

describe('데이터셋별 출처 메타데이터', () => {
  it('다문화학생 출처에는 외국인 유학생 통계표가 섞이지 않는다', () => {
    const tableIds = selectSourceMeta('multicultural').map((source) => source.tableId);

    expect(tableIds).toEqual([...MULTICULTURAL_TABLE_IDS]);
    for (const foreignTableId of FOREIGN_TABLE_IDS) {
      expect(tableIds).not.toContain(foreignTableId);
    }
  });

  it('외국인 유학생 출처에는 다문화학생 통계표가 섞이지 않는다', () => {
    const tableIds = selectSourceMeta('foreign').map((source) => source.tableId);

    expect([...tableIds].sort()).toEqual([...FOREIGN_TABLE_IDS].sort());
  });

  it('다문화학생 분자는 e-나라지표 시도별(F008403)·전국 장기(F008402)이고, F008401 은 대조용이다', () => {
    const sources = selectSourceMeta('multicultural');
    const byRole = (role: string) =>
      sources.filter((source) => source.role === role).map((source) => source.tableId);

    expect(byRole('numerator')).toEqual(['F008403', 'F008402']);
    expect(byRole('reference')).toEqual(['F008401']);
    expect(byRole('denominator')).toHaveLength(4);
  });
});
