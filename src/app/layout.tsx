import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Pretendard 가변 폰트(동적 서브셋, OFL-1.1) — unicode-range 로 쓰인 글자 범위만 내려받는다.
// globals.css 에서 @import 하지 않는다: Tailwind 가 url() 경로 처리를 가져가 basePath 가 빠진다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/styles/globals.css';
import { ko } from '@/content/ko';
import { pageMetadata, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: ko.app.metaTitle, template: `%s — ${ko.app.title}` },
  ...pageMetadata({ description: ko.app.metaDescription, path: '' }),
};

const themeInitializer = `(function () {
  try {
    var stored = localStorage.getItem('k-mosaic-theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.dataset.theme = stored;
      return;
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark';
    }
  } catch (error) {
    void error;
  }
})();`;

// 정적 HTML 의 히어로는 기본 필터(최신 연도)의 화면이다. 주소에 다른 필터가 있으면
// 클라이언트가 다시 그리기 전까지 가려 둔다 — 다른 연도의 수치가 잠깐 보이지 않게.
// (globals.css 의 [data-hero-pending] 규칙. 스크립트가 꺼져 있으면 기본 화면이 그대로 보인다.)
const heroPendingInitializer = `(function () {
  try {
    var query = new URLSearchParams(location.search);
    if (query.has('year') || query.has('level') || query.has('metric')) {
      document.documentElement.dataset.heroPending = '1';
    }
  } catch (error) {
    void error;
  }
})();`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
        <script dangerouslySetInnerHTML={{ __html: heroPendingInitializer }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
