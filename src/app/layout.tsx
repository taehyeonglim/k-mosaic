import type { Metadata } from 'next';
import type { ReactNode } from 'react';

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
