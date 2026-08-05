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
}

export function SourcePanel({ sources, rateFormula, notes }: SourcePanelProps) {
  return (
    <section className="space-y-5" aria-labelledby="source-panel-title">
      <h2 id="source-panel-title" className="text-xl font-medium">
        {ko.sources.title}
      </h2>

      {sources.map((source) => (
        <article className="space-y-3" key={`${source.role}-${source.tableId}`}>
          <h3 className="font-medium">
            {source.statisticsName} · {source.role}
          </h3>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="text-small text-[var(--km-color-text-muted)]">
                {ko.sources.tableName}
              </dt>
              <dd>{source.tableName}</dd>
            </div>
            <div>
              <dt className="text-small text-[var(--km-color-text-muted)]">{ko.sources.tableId}</dt>
              <dd>{source.tableId}</dd>
            </div>
            <div>
              <dt className="text-small text-[var(--km-color-text-muted)]">
                {ko.sources.organization}
              </dt>
              <dd>{source.organization}</dd>
            </div>
            <div>
              <dt className="text-small text-[var(--km-color-text-muted)]">
                {ko.sources.provider}
              </dt>
              <dd>{source.provider}</dd>
            </div>
            <div>
              <dt className="text-small text-[var(--km-color-text-muted)]">
                {ko.sources.updatedAt}
              </dt>
              <dd>{source.retrievedAt}</dd>
            </div>
            <div>
              <dt className="text-small text-[var(--km-color-text-muted)]">
                {ko.sources.referenceDate}
              </dt>
              <dd>{source.referenceDate ?? ko.sources.unknown}</dd>
            </div>
            <div>
              <dt className="text-small text-[var(--km-color-text-muted)]">
                {ko.sources.provisional}
              </dt>
              <dd>
                {source.isProvisional === null
                  ? ko.sources.unknown
                  : source.isProvisional.toString()}
              </dd>
            </div>
          </dl>
          <p>
            <a href={source.sourceUrl} target="_blank" rel="noreferrer">
              {source.sourceUrl}
            </a>
          </p>
        </article>
      ))}

      <dl className="space-y-2">
        <div>
          <dt className="text-small text-[var(--km-color-text-muted)]">{ko.sources.formula}</dt>
          <dd>
            <code>{rateFormula}</code>
          </dd>
        </div>
        <div>
          <dt className="text-small text-[var(--km-color-text-muted)]">{ko.sources.notes}</dt>
          <dd>
            <ul className="list-disc pl-5">
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
