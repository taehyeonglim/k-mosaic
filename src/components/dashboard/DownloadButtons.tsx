'use client';

export interface DownloadButtonLabels {
  filtered: string;
  all: string;
  dictionary: string;
}

export interface DownloadButtonsProps {
  onDownloadFiltered(): void;
  onDownloadAll(): void;
  onDownloadDictionary(): void;
  labels: DownloadButtonLabels;
}

export function DownloadButtons({
  onDownloadFiltered,
  onDownloadAll,
  onDownloadDictionary,
  labels,
}: DownloadButtonsProps) {
  return (
    <div className="viz-row" role="group" aria-label={labels.filtered}>
      <button type="button" className="btn" onClick={onDownloadFiltered}>
        {labels.filtered}
      </button>
      <button type="button" className="btn" onClick={onDownloadAll}>
        {labels.all}
      </button>
      <button type="button" className="btn" onClick={onDownloadDictionary}>
        {labels.dictionary}
      </button>
    </div>
  );
}
