import Link from 'next/link';

import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { ko } from '@/content/ko';

export default function NotFound() {
  return (
    <>
      <AppHeader brandName={ko.app.title} brandSubtitle={ko.app.subtitle} />
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
      <AppFooter
        geoAttribution={ko.common.geoAttribution}
        dataAttribution={ko.sources.organizationValue}
        ethicsNote={ko.ethics.aggregateOnly}
      />
    </>
  );
}
