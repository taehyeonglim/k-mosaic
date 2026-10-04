'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createDashboardData, type DashboardData } from '@/lib/data/dashboard-data';
import type { DashboardPayload } from '@/lib/data/dashboard-payload';

// 히어로(잉크 띠 안)와 본문(<main>)은 화면에서 떨어져 있는 별도의 클라이언트 영역이다.
// payload 를 한 번만 내려보내고 한 번만 디코딩해 둘이 함께 쓴다.

interface DashboardContextValue {
  payload: DashboardPayload;
  data: DashboardData;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardDataProvider({
  payload,
  children,
}: {
  payload: DashboardPayload;
  children: ReactNode;
}) {
  // 서버와 같은 순수 셀렉터 팩토리를 쓴다 — 셀렉터 테스트가 이 화면 경로를 그대로 검증한다.
  const value = useMemo(() => ({ payload, data: createDashboardData(payload) }), [payload]);
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const value = useContext(DashboardContext);
  if (value === null) throw new Error('DashboardDataProvider 밖에서 useDashboard 를 호출했습니다.');
  return value;
}
