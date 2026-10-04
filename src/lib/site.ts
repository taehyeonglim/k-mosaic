import type { Metadata } from 'next';

import { ko } from '@/content/ko';

// 배포 사이트의 절대 주소 — canonical·공유 카드·sitemap 이 함께 쓴다.
//
// GitHub Pages 프로젝트 페이지라 경로(/k-mosaic/)까지 포함한다. 커스텀 도메인이나 다른
// 플랫폼에 배포하면 NEXT_PUBLIC_SITE_URL 을 그 주소(끝에 / 포함)로 지정한다.
// 이 값은 공개 URL 이라 NEXT_PUBLIC_ 접두사를 써도 된다 (보안 규칙 S2 는 KEY·SECRET·TOKEN 금지).
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://taehyeonglim.github.io/k-mosaic/';

/** 사이트 기준 상대 경로('sources/')를 절대 URL 로 만든다. 앞의 / 는 붙이지 않는다. */
export function absoluteUrl(path = ''): string {
  return new URL(path.replace(/^\//, ''), SITE_URL).toString();
}

const OG_IMAGE = { url: absoluteUrl('og.png'), width: 1200, height: 630, alt: ko.app.ogImageAlt };

/**
 * 페이지별 메타데이터. Next.js 는 openGraph·twitter 를 페이지 단위로 통째로 덮어쓰므로
 * (레이아웃 값과 병합하지 않음) 공유 카드 항목을 매번 전부 채운다.
 */
export function pageMetadata(options: {
  title?: string;
  description: string;
  path: string;
}): Metadata {
  const url = absoluteUrl(options.path);
  const ogTitle =
    options.title === undefined ? ko.app.metaTitle : `${options.title} — ${ko.app.title}`;
  return {
    ...(options.title === undefined ? {} : { title: options.title }),
    description: options.description,
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description: options.description,
      url,
      siteName: ko.app.title,
      locale: 'ko_KR',
      type: 'website',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: options.description,
      images: [OG_IMAGE.url],
    },
  };
}
