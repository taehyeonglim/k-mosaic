import { ko } from '@/content/ko';

export interface SourcePanelSource {
  role: string;
  provider: string;
  organization: string;
  statisticsName: string;
  tableId: string;
  tableName: string;
  sourceUrl: string;
  retrievedAt: string;
  referenceDate: string | null;
  isProvisional: boolean | null;
}

export interface SourcePanelProps {
  sources: SourcePanelSource[];
  rateFormula: string;
  notes: string[];
  showCommonMeta?: boolean;
}

function sharedSourceValue<T>(
  sources: SourcePanelSource[],
  selectValue: (source: SourcePanelSource) => T,
): T | undefined {
  const firstSource = sources[0];
  if (firstSource === undefined) return undefined;

  const value = selectValue(firstSource);
  return sources.every((source) => selectValue(source) === value) ? value : undefined;
}

export function SourcePanel({
  sources,
  rateFormula,
  notes,
  showCommonMeta = true,
}: SourcePanelProps) {
  const sharedRetrievedAt = showCommonMeta
    ? sharedSourceValue(sources, (source) => source.retrievedAt)
    : undefined;
  const sharedReferenceDate = showCommonMeta
    ? sharedSourceValue(sources, (source) => source.referenceDate)
    : undefined;
  const sharedProvisional = showCommonMeta
    ? sharedSourceValue(sources, (source) => source.isProvisional)
    : undefined;
  const hasCommonMeta =
    showCommonMeta &&
    [sharedRetrievedAt, sharedReferenceDate, sharedProvisional].some(
      (value) => value !== undefined,
    );

  return (
    <section className="space-y-5" aria-labelledby="source-panel-title">
      <h2 id="source-panel-title" className="text-title font-semibold tracking-tight">
        {ko.sources.title}
      </h2>

      {hasCommonMeta ? (
        <dl className="grid gap-3 rounded-[var(--km-radius-md)] border border-border bg-surface-muted/45 p-3 text-sm sm:grid-cols-3">
          {sharedRetrievedAt !== undefined ? (
            <div className="min-w-0">
              <dt className="text-small text-text-muted">{ko.sources.updatedAt}</dt>
              <dd className="mt-1 break-words font-medium tabular-nums">
                {sharedRetrievedAt}
              </dd>
            </div>
          ) : null}
          {sharedReferenceDate !== undefined ? (
            <div className="min-w-0">
              <dt className="text-small text-text-muted">{ko.sources.referenceDate}</dt>
              <dd className="mt-1 break-words font-medium tabular-nums">
                {sharedReferenceDate ?? ko.sources.unknown}
              </dd>
            </div>
          ) : null}
          {sharedProvisional !== undefined ? (
            <div className="min-w-0">
              <dt className="text-small text-text-muted">{ko.sources.provisional}</dt>
              <dd className="mt-1 break-words font-medium">
                {sharedProvisional === null
                  ? ko.sources.unknown
                  : sharedProvisional.toString()}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {sources.map((source) => (
          <article
            className="min-w-0 rounded-[var(--km-radius-md)] border border-border bg-surface-muted/25 p-4"
            key={`${source.role}-${source.tableId}`}
          >
            <header className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold text-text">{source.tableName}</h3>
                <p className="mt-1 break-words text-small text-text-muted">
                  {source.statisticsName} · {source.role}
                </p>
              </div>
              <span className="inline-flex max-w-full shrink-0 items-center rounded-full border border-border bg-surface px-2 py-1 font-mono text-xs font-medium text-text">
                {source.tableId}
              </span>
            </header>

            <dl className="mt-3 grid min-w-0 gap-x-4 gap-y-2 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-small text-text-muted">{ko.sources.organization}</dt>
                <dd className="mt-0.5 break-words text-sm">{source.organization}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-small text-text-muted">{ko.sources.provider}</dt>
                <dd className="mt-0.5 break-words text-sm">{source.provider}</dd>
              </div>
              {showCommonMeta && sharedRetrievedAt === undefined ? (
                <div className="min-w-0">
                  <dt className="text-small text-text-muted">{ko.sources.updatedAt}</dt>
                  <dd className="mt-0.5 break-words text-sm tabular-nums">{source.retrievedAt}</dd>
                </div>
              ) : null}
              {showCommonMeta && sharedReferenceDate === undefined ? (
                <div className="min-w-0">
                  <dt className="text-small text-text-muted">{ko.sources.referenceDate}</dt>
                  <dd className="mt-0.5 break-words text-sm tabular-nums">
                    {source.referenceDate ?? ko.sources.unknown}
                  </dd>
                </div>
              ) : null}
              {showCommonMeta && sharedProvisional === undefined ? (
                <div className="min-w-0">
                  <dt className="text-small text-text-muted">{ko.sources.provisional}</dt>
                  <dd className="mt-0.5 break-words text-sm">
                    {source.isProvisional === null
                      ? ko.sources.unknown
                      : source.isProvisional.toString()}
                  </dd>
                </div>
              ) : null}
            </dl>

            <a
              className="btn btn-ghost mt-3 max-w-full justify-start px-0"
              href={source.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {ko.sources.originalLinkAction}
            </a>
          </article>
        ))}
      </div>

      <dl className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="min-w-0">
          <dt className="text-small text-text-muted">{ko.sources.formula}</dt>
          <dd className="mt-1">
            <code className="block overflow-x-auto rounded border border-border bg-surface-muted p-3 text-sm">
              {rateFormula}
            </code>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-small text-text-muted">{ko.sources.notes}</dt>
          <dd className="mt-1">
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
              {notes.map((note, index) => (
                <li key={`${index}-${note}`}>{note}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  );
}
