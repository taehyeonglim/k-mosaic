export interface AppFooterProps {
  geoAttribution: string;
  dataAttribution: string;
  ethicsNote: string;
}

export function AppFooter({ geoAttribution, dataAttribution, ethicsNote }: AppFooterProps) {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-[1440px] min-w-0 gap-4 px-4 py-5 text-small text-text-muted sm:grid-cols-3 sm:gap-6 sm:px-6 lg:px-8">
        <p className="min-w-0 break-words">{geoAttribution}</p>
        <p className="min-w-0 break-words">{dataAttribution}</p>
        <p className="min-w-0 break-words">{ethicsNote}</p>
      </div>
    </footer>
  );
}
