import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@/styles/globals.css';
import { ko } from '@/content/ko';

export const metadata: Metadata = {
  title: 'K-MOSAIC — Korea Multicultural Student Data Explorer',
  description: ko.app.subtitle,
  openGraph: {
    title: 'K-MOSAIC — Korea Multicultural Student Data Explorer',
    description: ko.app.tagline,
    locale: 'ko_KR',
    type: 'website',
  },
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
