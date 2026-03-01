import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type AiProvider = "openai" | "gemini" | "none";

export const AI_PROVIDER_STORAGE_KEY = "eat-planner-ai-provider";
export const OPENAI_KEY_STORAGE_KEY = "eat-planner-openai-key";
export const GEMINI_KEY_STORAGE_KEY = "eat-planner-gemini-key";

const aiProviderStorageAtom = atomWithStorage<AiProvider>(
  AI_PROVIDER_STORAGE_KEY,
  "none",
  undefined,
  { getOnInit: true }
);

const openAiKeyStorageAtom = atomWithStorage<string>(
  OPENAI_KEY_STORAGE_KEY,
  "",
  undefined,
  { getOnInit: true }
);

const geminiKeyStorageAtom = atomWithStorage<string>(
  GEMINI_KEY_STORAGE_KEY,
  "",
  undefined,
  { getOnInit: true }
);

export const aiProviderAtom = atom(
  (get) => get(aiProviderStorageAtom),
  (_get, set, nextValue: AiProvider) => {
    set(aiProviderStorageAtom, nextValue);
  }
);

export const openAiKeyAtom = atom(
  (get) => get(openAiKeyStorageAtom),
  (_get, set, nextValue: string) => {
    set(openAiKeyStorageAtom, nextValue.trim());
  }
);

export const geminiKeyAtom = atom(
  (get) => get(geminiKeyStorageAtom),
  (_get, set, nextValue: string) => {
    set(geminiKeyStorageAtom, nextValue.trim());
  }
);

export const activeAiKeyAtom = atom((get) => {
  const provider = get(aiProviderAtom);
  if (provider === "openai") return get(openAiKeyAtom);
  if (provider === "gemini") return get(geminiKeyAtom);
  return "";
});
