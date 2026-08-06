import Link from 'next/link';

import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageShell } from '@/components/layout/PageShell';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { SourcePanel } from '@/components/dashboard/SourcePanel';
import { Card } from '@/components/ui/Card';
import { ko } from '@/content/ko';
import { selectAvailableYears, selectSourceMeta } from '@/lib/data/selectors';
import { loadSnapshot } from '@/lib/data/snapshot';

const GEO_ATTRIBUTION =
  '행정경계: 통계청 통계지리정보서비스(SGIS) — 공공누리 제1유형 · 가공: vuski/admdongkor — CC BY 4.0';

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}

function sourcePanelSources() {
  return selectSourceMeta().map((source) => ({
    role:
      source.role === 'numerator' ? ko.sources.numeratorProvider : ko.sources.denominatorProvider,
    provider: source.provider,
    organization: source.organization,
    statisticsName: source.statisticsName,
    tableId: source.tableId,
    tableName: source.tableName,
    sourceUrl: source.sourceUrl,
    retrievedAt: formattedDate(source.retrievedAt),
    referenceDate: source.referenceDate,
    isProvisional: source.isProvisional,
  }));
}

export default function SourcesPage() {
  const snapshot = loadSnapshot();
  const years = selectAvailableYears();
  const latestYear = years[years.length - 1] ?? 0;
  const sources = sourcePanelSources();
  const referenceDate =
    sources.find((source) => source.referenceDate !== null)?.referenceDate ?? ko.sources.unknown;
  const provisional = sources.find((source) => source.isProvisional !== null)?.isProvisional;

  return (
    <>
      <AppHeader
        brandName={ko.app.title}
        brandSubtitle={ko.app.subtitle}
        dataYear={latestYear}
        lastUpdated={formattedDate(snapshot.retrievedAt)}
        sourceLabel={ko.nav.overview}
        sourceHref="/"
      />
      <PageShell>
        <div className="space-y-8">
          <nav
            aria-label={ko.foreignStudents.navigationLabel}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
          >
            <Link className="btn inline-flex" href="/">
              {ko.nav.overview}
            </Link>
            <ThemeToggle />
          </nav>
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

          <Card title={ko.sources.title} description={ko.trend.coverageNote}>
            <div className="space-y-3 text-sm leading-6 text-[var(--km-color-text-muted)]">
              <p>{ko.sources.ratePrecisionNote}</p>
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
                ko.sources.ratePrecisionNote,
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
        geoAttribution={GEO_ATTRIBUTION}
        dataAttribution={ko.sources.organizationValue}
        ethicsNote={ko.ethics.aggregateOnly}
      />
    </>
  );
}
