import { readFileSync } from 'node:fs';

// 테스트 전용: globals.css 의 디자인 토큰을 읽고 WCAG 대비를 계산한다.
// color-mix()·var() 는 계산하지 않는다 — 16진수 리터럴 토큰만 다룬다.

export interface CssBlock {
  /** 바깥 at-rule (예: '@media (prefers-color-scheme: dark)'). 없으면 null. */
  atRule: string | null;
  selector: string;
  declarations: Record<string, string>;
}

/** 최상위 규칙과 @media 안의 한 단계 중첩 규칙을 블록으로 나눈다. */
export function parseBlocks(css: string): CssBlock[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: CssBlock[] = [];
  let index = 0;

  function readRule(atRule: string | null): boolean {
    const open = text.indexOf('{', index);
    if (open < 0) return false;
    // '@import …;' 같은 블록 없는 문장이 앞에 붙어 있으면 잘라 낸다.
    const prelude = text.slice(index, open).split(';').pop()!.trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === '{') depth += 1;
      else if (text[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    const body = text.slice(open + 1, cursor - 1);
    if (prelude.startsWith('@media') || prelude.startsWith('@layer')) {
      for (const inner of parseBlocks(body)) {
        blocks.push({ ...inner, atRule: inner.atRule ?? prelude });
      }
    } else if (!prelude.startsWith('@')) {
      const declarations: Record<string, string> = {};
      for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        declarations[match[1]!] = match[2]!.trim();
      }
      blocks.push({ atRule, selector: prelude.replace(/\s+/g, ' '), declarations });
    }
    index = cursor;
    return true;
  }

  while (index < text.length && text.indexOf('{', index) >= 0) {
    if (!readRule(null)) break;
  }
  return blocks;
}

export function readGlobalsCss(): string {
  return readFileSync(new URL('../../src/styles/globals.css', import.meta.url), 'utf8');
}

export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`16진수 색이 아닙니다: ${hex}`);
  const value = match[1]!;
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** WCAG 2.x 상대 휘도 */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** base 위에 overlay 를 alpha 로 올린 색 (sRGB 단순 합성). */
export function blend(base: string, overlay: string, alpha: number): string {
  const [br, bg, bb] = hexToRgb(base);
  const [or, og, ob] = hexToRgb(overlay);
  const mix = (b: number, o: number) =>
    Math.round(o * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(br, or)}${mix(bg, og)}${mix(bb, ob)}`;
}
