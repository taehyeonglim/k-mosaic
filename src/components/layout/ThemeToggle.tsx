'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

import { Icon, type IconName } from '@/components/ui/Icon';
import { ko } from '@/content/ko';

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'k-mosaic-theme';
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const themeOptions: { value: ThemePreference; icon: IconName }[] = [
  { value: 'light', icon: 'sun' },
  { value: 'system', icon: 'system' },
  { value: 'dark', icon: 'moon' },
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
    <div
      aria-label={ko.theme.groupLabel}
      className="inline-flex max-w-full rounded-full border border-border bg-ink-raised p-1"
      role="group"
    >
      {themeOptions.map((option) => (
        <button
          aria-label={option.value}
          aria-pressed={theme === option.value}
          className={`inline-flex size-8 items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
            theme === option.value
              ? 'bg-surface-muted text-text ring-1 ring-border-strong'
              : 'text-text-muted hover:bg-surface-muted hover:text-text'
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
          <Icon name={option.icon} />
        </button>
      ))}
    </div>
  );
}
