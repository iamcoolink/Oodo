"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { Language, TranslationDictionary, TranslationKey } from "./types";
import { zh } from "./zh";
import { en } from "./en";

const STORAGE_KEY = "odoo-permission-studio.lang";

const dictionaries: Record<Language, TranslationDictionary> = {
  zh,
  en,
};

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, ...args: any[]) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // ignore
  }
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, ...args: any[]): string => {
      const dictionary = dictionaries[language];
      const value = dictionary[key];
      if (typeof value === "function") {
        return value(...args);
      }
      if (typeof value === "string") {
        return value;
      }
      return String(key);
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
