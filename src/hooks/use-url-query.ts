'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { applyQueryUpdates } from '@/lib/url-filters';

/** 현재 쿼리 문자열과, 쿼리를 바꿔 같은 경로로 이동하는 함수 (스크롤 유지). */
export function useUrlQuery(): {
  searchString: string;
  updateQuery: (updates: Parameters<typeof applyQueryUpdates>[1]) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchString = useSearchParams().toString();
  const updateQuery = useCallback(
    (updates: Parameters<typeof applyQueryUpdates>[1]) => {
      const query = applyQueryUpdates(searchString, updates);
      router.push(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchString],
  );
  return { searchString, updateQuery };
}
