import type { MetadataRoute } from 'next';

import { REGION_ORDER } from '@/lib/constants/regions';
import { absoluteUrl } from '@/lib/site';

// 정적 내보내기에서 sitemap.xml 로 생성된다.
// 프로젝트 페이지(서브패스)라 도메인 루트 robots.txt 는 제어할 수 없다 — 사이트맵은
// Search Console 등에 직접 제출하는 용도다.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '',
    'foreign-students/',
    'sources/',
    ...REGION_ORDER.map((code) => `regions/${code}/`),
  ].map((path) => ({ url: absoluteUrl(path) }));
}
