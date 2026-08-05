import { scaleQuantile, scaleSequential } from 'd3-scale';
import { interpolateBlues } from 'd3-scale-chromatic';

export type ColorScaleKind = 'quantile' | 'sequential';

export interface ColorScale {
  color(v: number | null): string;
  missingColor: string;
  breaks(): number[];
  kind: ColorScaleKind;
}

const COUNT_STEPS = 7;

function finiteValues(values: (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

function palette(mode: 'light' | 'dark', count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 0.5 : index / (count - 1);
    const lightness = mode === 'light' ? 0.12 + progress * 0.78 : 0.88 - progress * 0.64;
    return interpolateBlues(lightness);
  });
}

function missingColor(mode: 'light' | 'dark'): string {
  return mode === 'light' ? '#d9e2e5' : '#3b4d53';
}

/**
 * Creates a quantile scale for student counts.
 * `breaks()` returns the minimum, quantile thresholds, and maximum in ascending order.
 */
export function createCountScale(values: (number | null)[], mode: 'light' | 'dark'): ColorScale {
  const numbers = finiteValues(values);
  const missing = missingColor(mode);
  const quantile = scaleQuantile<string, string>(palette(mode, COUNT_STEPS))
    .domain(numbers)
    .unknown(missing);
  const domainMin = numbers.length > 0 ? Math.min(...numbers) : undefined;
  const domainMax = numbers.length > 0 ? Math.max(...numbers) : undefined;

  return {
    color(v) {
      return v === null ? missing : quantile(v);
    },
    missingColor: missing,
    breaks() {
      if (domainMin === undefined || domainMax === undefined) {
        return [];
      }
      return [domainMin, ...quantile.quantiles(), domainMax];
    },
    kind: 'quantile',
  };
}

/**
 * Creates a continuous, single-hue sequential scale for rates.
 * `breaks()` returns the numeric extent, which is used for the legend endpoints.
 */
export function createRateScale(values: (number | null)[], mode: 'light' | 'dark'): ColorScale {
  const numbers = finiteValues(values);
  const missing = missingColor(mode);
  const domainMin = numbers.length > 0 ? Math.min(...numbers) : undefined;
  const domainMax = numbers.length > 0 ? Math.max(...numbers) : undefined;
  const sequential = scaleSequential<string>((t) =>
    interpolateBlues(mode === 'light' ? 0.12 + t * 0.78 : 0.88 - t * 0.64),
  )
    .domain([domainMin ?? 0, domainMax ?? 1])
    .clamp(true)
    .unknown(missing);

  return {
    color(v) {
      return v === null ? missing : sequential(v);
    },
    missingColor: missing,
    breaks() {
      if (domainMin === undefined || domainMax === undefined) {
        return [];
      }
      return [domainMin, domainMax];
    },
    kind: 'sequential',
  };
}
