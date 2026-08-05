'use client';

import { PageShell } from '@/components/layout/PageShell';
import { ErrorState } from '@/components/ui/ErrorState';
import { ko } from '@/content/ko';
import Link from 'next/link';

export default function Error({ reset }: { error: Error & { digest?: string }; reset(): void }) {
  return (
    <PageShell>
      <div className="space-y-4">
        <ErrorState title={ko.errors.generic} description={ko.errors.dataLoad} onRetry={reset} />
        <Link className="btn inline-flex" href="/">
          {ko.nav.overview}
        </Link>
      </div>
    </PageShell>
  );
}
