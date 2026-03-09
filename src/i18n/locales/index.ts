import CN from "./cn";
import EN from "./en";

export type { LocaleType } from "./cn";

export type Lang = "en" | "cn";

export const AllLangs: Lang[] = ["en", "cn"];

export const LANG_KEY = "lang";

function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function getLanguage(): string {
  try {
    return navigator.languages.join(",").toLowerCase();
  } catch {
    return "cn";
  }
}

export function getLang(): Lang {
  const savedLang = getItem(LANG_KEY);

  if (AllLangs.includes(savedLang as Lang)) {
    return savedLang as Lang;
  }

  const lang = getLanguage();

  if (lang.includes("zh") || lang.includes("cn")) {
    return "cn";
  } else {
    return "en";
  }
}

export function changeLang(lang: Lang): void {
  setItem(LANG_KEY, lang);
  location.reload();
}

export const translations = {
  en: EN,
  cn: CN,
} as const;

export default translations[getLang()];
