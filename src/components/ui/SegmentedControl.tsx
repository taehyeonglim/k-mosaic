'use client';

import { useId, useRef } from 'react';

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange(v: T): void;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  const labelId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );

  return (
    <div className="min-w-0">
      <p className="form-label mb-1.5" id={labelId}>
        {label}
      </p>
      <div
        aria-labelledby={labelId}
        aria-orientation="horizontal"
        className="segmented"
        role="radiogroup"
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;

          return (
            <button
              aria-checked={isSelected}
              className="segmented-item"
              key={option.value}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => {
                let nextIndex: number | null = null;

                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  nextIndex = options.length > 0 ? (index + 1) % options.length : null;
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  nextIndex =
                    options.length > 0 ? (index - 1 + options.length) % options.length : null;
                } else if (event.key === 'Home') {
                  nextIndex = options.length > 0 ? 0 : null;
                } else if (event.key === 'End') {
                  nextIndex = options.length > 0 ? options.length - 1 : null;
                }

                if (nextIndex === null) return;

                const nextOption = options[nextIndex];
                if (!nextOption) return;

                event.preventDefault();
                onChange(nextOption.value);
                optionRefs.current[nextIndex]?.focus();
              }}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              role="radio"
              tabIndex={index === selectedIndex ? 0 : -1}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
