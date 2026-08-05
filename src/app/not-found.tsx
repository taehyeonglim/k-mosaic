import Link from 'next/link';

import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { ko } from '@/content/ko';

export default function NotFound() {
  return (
    <PageShell>
      <EmptyState
        title={ko.errors.routeNotFound}
        description={ko.errors.generic}
        action={
          <Link className="btn" href="/">
            {ko.nav.overview}
          </Link>
        }
      />
    </PageShell>
  );
}
