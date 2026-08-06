import { scaleQuantile, scaleQuantize } from 'd3-scale';

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

function palette(mode: 'light' | 'dark', kind: 'count' | 'rate', count: number): string[] {
  void mode;
  return Array.from({ length: count }, (_, index) => `var(--km-map-${kind}-${index + 1})`);
}

function missingColor(mode: 'light' | 'dark'): string {
  void mode;
  return 'var(--km-color-missing)';
}

/**
 * Creates a quantile scale for student counts.
 * `breaks()` returns the minimum, quantile thresholds, and maximum in ascending order.
 */
export function createCountScale(values: (number | null)[], mode: 'light' | 'dark'): ColorScale {
  const numbers = finiteValues(values);
  const missing = missingColor(mode);
  const quantile = scaleQuantile<string, string>(palette(mode, 'count', COUNT_STEPS))
    .domain(numbers)
    .unknown(missing);
  const domainMin = numbers.length > 0 ? Math.min(...numbers) : undefined;
  const domainMax = numbers.length > 0 ? Math.max(...numbers) : undefined;

  return {
    color(v) {
      return v === null || !Number.isFinite(v) ? missing : quantile(v);
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
 * Creates a seven-step, single-hue quantized scale for rates.
 * `breaks()` returns the numeric extent, which is used for the legend endpoints.
 */
export function createRateScale(values: (number | null)[], mode: 'light' | 'dark'): ColorScale {
  const numbers = finiteValues(values);
  const missing = missingColor(mode);
  const domainMin = numbers.length > 0 ? Math.min(...numbers) : undefined;
  const domainMax = numbers.length > 0 ? Math.max(...numbers) : undefined;
  const quantize = scaleQuantize<string, string>(palette(mode, 'rate', COUNT_STEPS))
    .domain([domainMin ?? 0, domainMax ?? 1])
    .unknown(missing);

  return {
    color(v) {
      return v === null || !Number.isFinite(v) ? missing : quantize(v);
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
