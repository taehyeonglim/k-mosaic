// 데이터셋별 출처 통계표 ID — 출처 패널·검증 규칙이 공유하는 단일 목록.
//
// sources.v1.json 은 두 데이터셋의 출처를 한 파일에 담는다. 화면에서 데이터셋을
// 구분하지 않고 출처를 나열하면 외국인 유학생 표(153401, 010_S)가 다문화학생의
// 분자·분모로 잘못 표시된다. 출처를 읽는 곳은 반드시 이 목록으로 거른다.

/** 다문화학생: 분자 e-나라지표 F008403 + 분모 KOSIS 교육기본통계 개황표 4종 (표시 순서) */
export const MULTICULTURAL_TABLE_IDS = [
  'F008403',
  'DT_1963003_002',
  'DT_1963003_003',
  'DT_1963003_004',
  'DT_1963003_009',
] as const;

/** 대학 외국인 유학생: 시도별 KOSIS 고등교육기관 개황 + 전국 장기 시계열 e-나라지표 153401 */
export const FOREIGN_TABLE_IDS = ['DT_1963003_010_S', '153401'] as const;

export type SourceDataset = 'multicultural' | 'foreign';

export const TABLE_IDS_BY_DATASET: Record<SourceDataset, readonly string[]> = {
  multicultural: MULTICULTURAL_TABLE_IDS,
  foreign: FOREIGN_TABLE_IDS,
};
