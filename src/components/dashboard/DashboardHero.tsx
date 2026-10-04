'use client';

import { useMemo } from 'react';

import { useUrlQuery } from '@/hooks/use-url-query';
import { buildHeroData } from '@/lib/data/hero';
import { readDashboardFilters } from '@/lib/url-filters';

import { useDashboard } from './DashboardDataProvider';
import { HeroView } from './HeroView';

/** URL 필터를 읽어 히어로를 다시 그린다. 본문(DashboardClient)과 같은 주소·같은 셀렉터를 본다. */
export function DashboardHero() {
  const { data } = useDashboard();
  const { searchString } = useUrlQuery();
  const hero = useMemo(
    () => buildHeroData(data, readDashboardFilters(new URLSearchParams(searchString), data.years)),
    [data, searchString],
  );

  return <HeroView hero={hero} />;
}
