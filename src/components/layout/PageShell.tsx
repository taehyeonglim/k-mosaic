import type { ReactNode } from 'react';

export interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-w-0 bg-canvas font-sans text-text">
      <main
        className="mx-auto min-h-[60vh] w-full max-w-[1440px] min-w-0 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
