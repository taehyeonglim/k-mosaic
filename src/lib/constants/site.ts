/**
 * 사이트 외부 링크 상수.
 *
 * URL 은 언어별 문자열이 아니므로 src/content/ko.ts 가 아니라 여기에 둔다.
 * 라벨(한국어 문구)은 ko.footer 에 있다.
 */
export const SITE_REPO_URL = 'https://github.com/taehyeonglim/k-mosaic';

/** 화면 서체 — 자체 호스팅하는 파일의 저작권·라이선스 표기에 쓴다. */
export const SITE_FONT = {
  name: 'Pretendard',
  url: 'https://github.com/orioncactus/pretendard',
  license: 'SIL Open Font License 1.1',
} as const;

export const SITE_DEVELOPER = {
  /** 표시 이름 — GitHub 프로필의 공개 이름을 따른다. */
  name: 'Taehyeong Lim',
  url: 'https://github.com/taehyeonglim',
} as const;
