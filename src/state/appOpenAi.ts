import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const OPENAI_KEY_STORAGE_KEY = "eat-planner-openai-key";

const openAiKeyStorageAtom = atomWithStorage<string>(OPENAI_KEY_STORAGE_KEY, "", undefined, {
  getOnInit: true,
});

export const openAiKeyAtom = atom(
  (get) => get(openAiKeyStorageAtom),
  (_get, set, nextValue: string) => {
    set(openAiKeyStorageAtom, nextValue);
  }
);

export const sanitizeOpenAiKey = (value: string) => value.trim();
