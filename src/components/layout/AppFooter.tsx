import { ko } from '@/content/ko';
import { SITE_DEVELOPER, SITE_REPO_URL } from '@/lib/constants/site';

export interface AppFooterProps {
  geoAttribution: string;
  dataAttribution: string;
  ethicsNote: string;
}

/** 새 창으로 여는 외부 링크. 스크린리더에는 "(새 창)" 힌트를 함께 읽힌다. */
function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      className="min-w-0 break-words font-medium text-text underline decoration-border underline-offset-2 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <span className="sr-only"> {ko.footer.externalLinkHint}</span>
    </a>
  );
}

export function AppFooter({ geoAttribution, dataAttribution, ethicsNote }: AppFooterProps) {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid min-w-0 gap-4 text-small text-text-muted sm:grid-cols-3 sm:gap-6">
          <p className="min-w-0 break-words">{geoAttribution}</p>
          <p className="min-w-0 break-words">{dataAttribution}</p>
          <p className="min-w-0 break-words">{ethicsNote}</p>
        </div>
        <div className="mt-4 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border pt-4 text-small text-text-muted">
          <ExternalLink href={SITE_REPO_URL}>{ko.footer.repoLabel}</ExternalLink>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 break-words">{ko.footer.developerLabel}</span>
          <ExternalLink href={SITE_DEVELOPER.url}>{SITE_DEVELOPER.name}</ExternalLink>
        </div>
      </div>
    </footer>
  );
}
