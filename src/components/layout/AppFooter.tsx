import { ko } from '@/content/ko';
import { SITE_DEVELOPER, SITE_FONT, SITE_REPO_URL } from '@/lib/constants/site';

export interface AppFooterProps {
  geoAttribution: string;
  dataAttribution: string;
  ethicsNote: string;
}

/** 새 창으로 여는 외부 링크. 스크린리더에는 "(새 창)" 힌트를 함께 읽힌다. */
function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      className="min-w-0 break-words font-medium text-text underline decoration-border-strong underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
    // 잉크 띠 안에서는 테마와 무관하게 다크 토큰이 적용된다 (globals.css 의 .ink-band).
    <footer className="ink-band font-sans">
      <div className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid min-w-0 gap-4 text-small text-text-muted sm:grid-cols-3 sm:gap-8">
          <p className="min-w-0 break-words">{geoAttribution}</p>
          <p className="min-w-0 break-words">{dataAttribution}</p>
          <p className="min-w-0 break-words">{ethicsNote}</p>
        </div>
        <ul className="mt-6 flex min-w-0 flex-wrap gap-x-6 gap-y-2 border-t border-border pt-5 text-small text-text-muted">
          <li className="min-w-0">
            <ExternalLink href={SITE_REPO_URL}>{ko.footer.repoLabel}</ExternalLink>
          </li>
          <li className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span>{ko.footer.developerLabel}</span>
            <ExternalLink href={SITE_DEVELOPER.url}>{SITE_DEVELOPER.name}</ExternalLink>
          </li>
          <li className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span>{ko.footer.fontLabel}</span>
            <ExternalLink href={SITE_FONT.url}>{SITE_FONT.name}</ExternalLink>
            <span>{SITE_FONT.license}</span>
          </li>
        </ul>
      </div>
    </footer>
  );
}
