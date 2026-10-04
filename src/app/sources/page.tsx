import type { Metadata } from 'next';
import Link from 'next/link';

import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { SourcePanel } from '@/components/dashboard/SourcePanel';
import { Card } from '@/components/ui/Card';
import { ko } from '@/content/ko';
import { fillTemplate, formatRatePrecisionNote, formatYearRange } from '@/content/template';
import { selectAvailableYears, selectIntegerRoundedYears } from '@/lib/data/selectors';
import { formattedDate, multiculturalSourcePanelSources } from '@/lib/data/source-panel';
import { loadSnapshot } from '@/lib/data/snapshot';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: ko.sources.title,
  description: ko.sources.metaDescription,
  path: 'sources/',
});

export default function SourcesPage() {
  const snapshot = loadSnapshot();
  const years = selectAvailableYears();
  const latestYear = years[years.length - 1] ?? 0;
  const sources = multiculturalSourcePanelSources();
  const ratePrecisionNote = formatRatePrecisionNote(
    ko.sources.ratePrecisionNote,
    selectIntegerRoundedYears(),
  );
  const referenceDate =
    sources.find((source) => source.referenceDate !== null)?.referenceDate ?? ko.sources.unknown;
  const provisional = sources.find((source) => source.isProvisional !== null)?.isProvisional;

  return (
    <>
      <AppHeader
        brandName={ko.app.title}
        brandSubtitle={ko.app.subtitle}
        dataYear={latestYear}
        current="sources"
        lastUpdated={formattedDate(snapshot.retrievedAt)}
      />
      <PageShell>
        <div className="space-y-8">
          <PageHeader title={ko.nav.sources} description={ko.sources.metaDescription} />
          <Card title={ko.sources.title} description={ko.sources.tableNameValue}>
            <div className="space-y-4">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-small text-[var(--km-color-text-muted)]">
                    {ko.sources.updatedAt}
                  </dt>
                  <dd>{formattedDate(snapshot.retrievedAt)}</dd>
                </div>
                <div>
                  <dt className="text-small text-[var(--km-color-text-muted)]">
                    {ko.sources.referenceDate}
                  </dt>
                  <dd>{referenceDate}</dd>
                </div>
                <div>
                  <dt className="text-small text-[var(--km-color-text-muted)]">
                    {ko.sources.provisional}
                  </dt>
                  <dd>
                    {provisional === undefined || provisional === null
                      ? ko.sources.unknown
                      : provisional.toString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-small text-[var(--km-color-text-muted)]">
                    {ko.sources.processed}
                  </dt>
                  <dd>{ko.sources.computedRate}</dd>
                </div>
              </dl>
              <p className="text-small text-[var(--km-color-text-muted)]">
                {ko.sources.sourceStatusNote}
              </p>
            </div>
          </Card>

          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <Card title={ko.ethics.termTitle} description={ko.ethics.definition}>
              <div className="space-y-3 text-sm leading-6 text-[var(--km-color-text-muted)]">
                <p>{ko.ethics.limitation}</p>
                <p>{ko.ethics.categoryLimitation}</p>
                <p>{ko.ethics.aggregateOnly}</p>
              </div>
            </Card>
            <Card title={ko.sources.formula}>
              <div className="space-y-3">
                <code className="block overflow-x-auto rounded border border-border bg-surface-muted p-3 text-sm">
                  {ko.sources.formulaValue}
                </code>
                <p className="text-sm leading-6 text-[var(--km-color-text-muted)]">
                  {ko.sources.schoolLevelNote}
                </p>
                <p className="text-sm leading-6 text-[var(--km-color-text-muted)]">
                  {ko.missing.rateUnavailable}
                </p>
                <p className="text-sm leading-6 text-[var(--km-color-text-muted)]">
                  {ko.missing.sourceMissing}
                </p>
              </div>
            </Card>
          </div>

          <Card
            title={ko.sources.title}
            description={fillTemplate(ko.trend.coverageNote, {
              ...formatYearRange(years),
              nationwideStart: formatYearRange(snapshot.coverage.nationwideYears).start,
              nationwideEnd: formatYearRange(snapshot.coverage.nationwideYears).end,
            })}
          >
            <div className="space-y-3 text-sm leading-6 text-[var(--km-color-text-muted)]">
              {ratePrecisionNote !== null ? <p>{ratePrecisionNote}</p> : null}
              <p>{ko.trend.missingSegment}</p>
              <p>{ko.ethics.noCausalInterpretation}</p>
            </div>
          </Card>

          <Card title={ko.sources.originalLinks}>
            <SourcePanel
              sources={sources}
              rateFormula={ko.sources.formulaValue}
              showCommonMeta={false}
              notes={[
                ...(ratePrecisionNote !== null ? [ratePrecisionNote] : []),
                ko.sources.schoolLevelNote,
                ko.sources.sourceStatusNote,
              ]}
            />
          </Card>

          <Card title={ko.download.title} description={ko.download.provenanceNote}>
            <Link className="btn inline-flex" href="/#downloads">
              {ko.download.title}
            </Link>
          </Card>
        </div>
      </PageShell>
      <AppFooter
        geoAttribution={ko.common.geoAttribution}
        dataAttribution={ko.sources.organizationValue}
        ethicsNote={ko.ethics.aggregateOnly}
      />
    </>
  );
}
