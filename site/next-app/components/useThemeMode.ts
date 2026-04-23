'use client';

/**
 * `useThemeMode()` — three-way theme selection for the PageShot panel.
 *
 * Mode values:
 *   - `auto`  — follow the browser's `prefers-color-scheme`. Listens for
 *               system changes and updates `resolved` live.
 *   - `light` — force light, regardless of system preference.
 *   - `dark`  — force dark, regardless of system preference.
 *
 * `resolved` is always `'light' | 'dark'` — never `'auto'` — so consumers
 * can apply styling unconditionally. Blok uses class-based dark mode
 * (`@custom-variant dark (&:is(.dark *))`), so the panel applies the
 * `.dark` class on its root element when `resolved === 'dark'`.
 *
 * Persistence: the user's explicit choice (`light` / `dark`) is stored in
 * `localStorage`. If the stored value is missing or invalid, the hook
 * defaults to `auto`.
 */

import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'pageshot.theme';

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw;
  } catch {
    // Storage blocked (private mode, iframe restrictions) — fall back.
  }
  return 'auto';
}

function writeStoredMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Best-effort — a storage-blocked environment still gets session state.
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export interface UseThemeModeResult {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (next: ThemeMode) => void;
}

export function useThemeMode(): UseThemeModeResult {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    getSystemTheme(),
  );

  // Re-read stored mode on mount in case SSR hydration produced 'auto' but
  // localStorage has a user choice. Safe to run unconditionally on mount.
  useEffect(() => {
    const stored = readStoredMode();
    setModeState((prev) => (prev === stored ? prev : stored));
  }, []);

  // Listen for system theme changes while in `auto` mode. Also listens
  // regardless of current mode so that switching back to `auto` immediately
  // reflects the live system value.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  const setMode = useCallback<UseThemeModeResult['setMode']>((next) => {
    setModeState(next);
    writeStoredMode(next);
  }, []);

  const resolved: ResolvedTheme =
    mode === 'auto' ? systemTheme : mode;

  return { mode, resolved, setMode };
}
