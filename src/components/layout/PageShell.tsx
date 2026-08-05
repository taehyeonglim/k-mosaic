import ko from '@/content/ko';
import type { ReactNode } from 'react';
import { SkipLink } from './SkipLink';

export interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen min-w-0 bg-canvas font-sans text-text">
      <SkipLink label={ko.nav.overview} targetId="main-content" />
      <main
        className="mx-auto min-h-[60vh] w-full max-w-[1440px] min-w-0 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
