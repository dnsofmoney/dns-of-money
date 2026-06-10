// Zero-dependency i18n layer for the xApp.
//
// - Catalogs live in en.ts (source of truth) and ja.ts (type-checked clone).
// - Locale resolution priority: manual override (localStorage) → Xaman OTT
//   locale → browser language → English fallback.
// - t("a.b.c", { name }) does dot-path lookup + {placeholder} interpolation.
//   Unknown keys return the key itself, so a missing string is visible, not
//   blank.
//
// Adding a locale = add a catalog file, register it in CATALOGS, add the code
// to SUPPORTED. No other change needed.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { en } from "./en";
import { ja } from "./ja";
import type { Messages } from "./en";

export type Locale = "en" | "ja";

export const SUPPORTED: Locale[] = ["en", "ja"];

const CATALOGS: Record<Locale, Messages> = { en, ja };

/** Human-readable name shown in the language switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
};

const STORAGE_KEY = "xapp.locale";

/** "ja-JP" → "ja"; returns null if the base tag isn't supported. */
function normalize(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split("-")[0];
  return (SUPPORTED as string[]).includes(base) ? (base as Locale) : null;
}

function readStored(): Locale | null {
  try {
    return normalize(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Initial best guess before the Xaman session resolves. */
function detectInitial(): Locale {
  return readStored() ?? normalize(navigator.language) ?? "en";
}

/** Resolve a dot path like "register.step1Title" against a catalog. */
function lookup(catalog: Messages, path: string): string | undefined {
  let node: unknown = catalog;
  for (const key of path.split(".")) {
    if (node && typeof node === "object" && key in node) {
      node = (node as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

export type TFunc = (path: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  /** Persist a manual choice (default) or apply a detected one (persist=false). */
  setLocale: (loc: Locale, persist?: boolean) => void;
  t: TFunc;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitial);

  const setLocale = useCallback((loc: Locale, persist = true) => {
    setLocaleState(loc);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, loc);
      } catch {
        /* private mode — in-memory only */
      }
    }
  }, []);

  // Keep <html lang> accurate for a11y / screen readers.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback<TFunc>(
    (path, vars) => {
      const raw = lookup(CATALOGS[locale], path) ?? lookup(CATALOGS.en, path) ?? path;
      return interpolate(raw, vars);
    },
    [locale],
  );

  const value = useMemo<I18nValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

/** Convenience: just the translate function. */
export function useT(): TFunc {
  return useI18n().t;
}

/**
 * Apply the Xaman-reported locale once the session resolves — but never
 * override a manual choice the user has already stored.
 */
export function useXamanLocale(xamanLocale: string | undefined) {
  const { setLocale } = useI18n();
  useEffect(() => {
    if (readStored()) return; // user picked one — respect it
    const detected = normalize(xamanLocale);
    if (detected) setLocale(detected, false);
  }, [xamanLocale, setLocale]);
}
