import { useSyncExternalStore } from "react";
import { translations, getLang, changeLang, AllLangs, type Lang, type LocaleType } from "./locales";

const empty = () => "";

function subscribe() {
  return empty;
}

export function useTranslation(): LocaleType {
  return useSyncExternalStore(subscribe, () => translations[getLang()], () => translations.en);
}

export { type LocaleType, type Lang, AllLangs, getLang, changeLang, translations };
export default translations;
