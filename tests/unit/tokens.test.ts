import { describe, expect, it } from 'vitest';

import { blend, contrast, luminance, parseBlocks, readGlobalsCss } from '../helpers/css-tokens';

// 디자인 토큰의 접근성 계약. axe 는 그라데이션 위 글자를 '판정 불가'로 넘기므로
// (잉크 띠), 색 대비는 토큰 단계에서 직접 검사한다. docs/design-system.md §2 참조.

const blocks = parseBlocks(readGlobalsCss());

function tokens(predicate: (block: (typeof blocks)[number]) => boolean, label: string) {
  const found = blocks
    .filter(predicate)
    .filter((block) => '--km-color-canvas' in block.declarations);
  if (found.length !== 1)
    throw new Error(`${label} 토큰 블록을 하나로 특정할 수 없습니다 (${found.length})`);
  return found[0]!.declarations;
}

const light = tokens((block) => block.atRule === null && block.selector === ':root', 'light');
const dark = tokens(
  (block) => block.atRule === null && block.selector.includes("[data-theme='dark']"),
  'dark',
);
const darkMedia = tokens(
  (block) => block.atRule !== null && block.atRule.includes('prefers-color-scheme: dark'),
  'dark media',
);

const RAMP = [1, 2, 3, 4, 5, 6, 7] as const;
const themes = [
  ['라이트', light],
  ['다크', dark],
] as const;

function color(theme: Record<string, string>, name: string): string {
  const value = theme[name];
  if (value === undefined) throw new Error(`토큰이 없습니다: ${name}`);
  return value;
}

describe('테마 블록 구조', () => {
  it('시스템 다크(@media)와 data-theme=dark 블록의 토큰 값이 같다', () => {
    expect(darkMedia).toEqual(dark);
  });

  it('잉크 띠(.ink-band)는 테마와 무관하게 다크 토큰을 쓴다', () => {
    const selector = blocks.find(
      (block) => block.atRule === null && block.selector.includes("[data-theme='dark']"),
    )?.selector;
    expect(selector).toContain('.ink-band');
  });

  it('잉크 띠 배경색은 두 테마에서 같다', () => {
    expect(color(dark, '--km-color-ink')).toBe(color(light, '--km-color-ink'));
  });

  it('글꼴 스택은 실제로 로드하는 Pretendard Variable 로 시작한다', () => {
    expect(color(light, '--km-font-sans')).toMatch(/^'Pretendard Variable'/);
  });
});

describe.each(themes)('%s 테마 색 대비', (_, theme) => {
  const surfaces = ['--km-color-canvas', '--km-color-surface', '--km-color-surface-muted'];

  it.each(surfaces)('본문·보조 글자가 %s 위에서 4.5:1 이상이다', (surface) => {
    expect(contrast(color(theme, '--km-color-text'), color(theme, surface))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrast(color(theme, '--km-color-text-muted'), color(theme, surface)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('링크·버튼 색(브랜드, 강조 보라)이 표면 위에서 4.5:1 이상이다', () => {
    const surface = color(theme, '--km-color-surface');
    expect(contrast(color(theme, '--km-color-accent'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(theme, '--km-color-accent2'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(color(theme, '--km-color-accent-contrast'), color(theme, '--km-color-accent')),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('선택 표시(강조 보라) 위의 글자·기호가 4.5:1 이상이다', () => {
    // 체크 표시: 보라 바탕 위의 accent2-contrast. 선택된 칩: 옅은 보라 바탕 위의 본문색.
    expect(
      contrast(color(theme, '--km-color-accent2-contrast'), color(theme, '--km-color-accent2')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(color(theme, '--km-color-text'), color(theme, '--km-color-accent2-soft')),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('순위 막대(램프 5단계, 선택 시 강조 보라)가 표면 위에서 3:1 이상이다', () => {
    const surface = color(theme, '--km-color-surface');
    expect(contrast(color(theme, '--km-ramp-5'), surface)).toBeGreaterThanOrEqual(3);
    // 행에 마우스를 올리면 배경이 표면-약 쪽으로 바뀐다.
    expect(
      contrast(color(theme, '--km-ramp-5'), color(theme, '--km-color-surface-muted')),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(color(theme, '--km-color-accent2'), color(theme, '--km-color-surface-muted')),
    ).toBeGreaterThanOrEqual(3);
  });

  it('의미색(오류·품질 안내)이 표면 위에서 4.5:1 이상이다', () => {
    const surface = color(theme, '--km-color-surface');
    expect(contrast(color(theme, '--km-color-destructive'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(theme, '--km-color-quality-note'), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('포커스 링과 입력 테두리가 표면·캔버스 위에서 3:1 이상이다', () => {
    for (const surface of ['--km-color-surface', '--km-color-canvas']) {
      expect(
        contrast(color(theme, '--km-color-focus'), color(theme, surface)),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(color(theme, '--km-color-border-strong'), color(theme, surface)),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('계열색 3종이 표면 위에서 3:1 이상이다', () => {
    for (const slot of [1, 2, 3]) {
      expect(
        contrast(color(theme, `--km-series-${slot}`), color(theme, '--km-color-surface')),
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('지도 순차 램프', () => {
  it('라이트 램프는 단계가 올라갈수록 어두워진다', () => {
    const values = RAMP.map((step) => luminance(color(light, `--km-ramp-${step}`)));
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('다크 램프는 단계가 올라갈수록 밝아진다 (잉크 띠 공용)', () => {
    const values = RAMP.map((step) => luminance(color(dark, `--km-ramp-${step}`)));
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it.each(themes)('%s: 가장 옅은 단계도 표면과 2:1 이상으로 구분된다', (_, theme) => {
    expect(
      contrast(color(theme, '--km-ramp-1'), color(theme, '--km-color-surface')),
    ).toBeGreaterThanOrEqual(2);
  });

  it('다크 램프의 가장 옅은 단계는 잉크 띠 위에서도 2:1 이상이다', () => {
    expect(
      contrast(color(dark, '--km-ramp-1'), color(dark, '--km-color-ink')),
    ).toBeGreaterThanOrEqual(2);
  });

  it.each(themes)('%s: 램프 위 글자(타일 라벨)가 모든 단계에서 4.5:1 이상이다', (_, theme) => {
    for (const step of RAMP) {
      expect(
        contrast(color(theme, `--km-on-ramp-${step}`), color(theme, `--km-ramp-${step}`)),
        `단계 ${step}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('이전 토큰 이름(map-count·map-rate)은 새 램프의 별칭이다', () => {
    for (const step of RAMP) {
      expect(color(light, `--km-map-count-${step}`)).toBe(`var(--km-ramp-${step})`);
      expect(color(light, `--km-map-rate-${step}`)).toBe(`var(--km-ramp-${step})`);
    }
  });
});

describe('잉크 띠 위의 글자', () => {
  // globals.css 의 .ink-band 배경 광원과 같은 값이어야 한다 (color-mix 는 테스트가 계산하지 못한다).
  const GLOW_ALPHA = { '--km-ink-glow-violet': 0.42, '--km-ink-glow-teal': 0.38 } as const;
  const ink = color(dark, '--km-color-ink');
  const backgrounds = [
    ink,
    color(dark, '--km-color-ink-raised'),
    ...Object.entries(GLOW_ALPHA).map(([token, alpha]) => blend(ink, color(dark, token), alpha)),
  ];

  it.each(backgrounds)('본문·보조 글자가 %s 위에서 4.5:1 이상이다', (background) => {
    expect(contrast(color(dark, '--km-color-text'), background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(dark, '--km-color-text-muted'), background)).toBeGreaterThanOrEqual(4.5);
  });

  it('포커스 링이 잉크 띠 위에서 3:1 이상이다', () => {
    for (const background of backgrounds) {
      expect(contrast(color(dark, '--km-color-focus'), background)).toBeGreaterThanOrEqual(3);
    }
  });
});
