'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'k-mosaic-theme';
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const themeOptions: { value: ThemePreference; icon: string }[] = [
  { value: 'light', icon: '☀' },
  { value: 'system', icon: '◐' },
  { value: 'dark', icon: '☾' },
];

function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      return storedTheme;
    }
  } catch {
    return 'system';
  }

  return 'system';
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
}

function persistTheme(theme: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A restricted storage context should not prevent theme changes.
  }
}

export interface ThemeToggleProps {}

export function ThemeToggle({}: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemePreference>('system');

  useClientLayoutEffect(() => {
    const storedTheme = readStoredTheme();
    applyTheme(storedTheme);
    setTheme(storedTheme);
  }, []);

  return (
    <div className="inline-flex max-w-full rounded-[var(--km-radius-md)] border border-border bg-surface-muted p-1">
      {themeOptions.map((option) => (
        <button
          aria-label={option.value}
          aria-pressed={theme === option.value}
          className={`inline-flex size-9 items-center justify-center rounded-[var(--km-radius-sm)] text-base transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
            theme === option.value
              ? 'bg-surface font-semibold text-text shadow-sm ring-1 ring-border'
              : 'text-text-muted hover:bg-surface/70 hover:text-text'
          }`}
          key={option.value}
          onClick={() => {
            setTheme(option.value);
            applyTheme(option.value);
            persistTheme(option.value);
          }}
          title={option.value}
          type="button"
        >
          <span aria-hidden="true">{option.icon}</span>
        </button>
      ))}
    </div>
  );
}
