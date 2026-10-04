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

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
