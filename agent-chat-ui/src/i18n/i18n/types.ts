export type Language = "zh" | "en";

export type TranslationValue = string | ((...args: any[]) => string);

export interface TranslationDictionary {
  [key: string]: TranslationValue;
}

export type TranslationKey = keyof TranslationDictionary;
