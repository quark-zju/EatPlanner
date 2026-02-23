import { getDefaultStore } from "jotai";
import { downloadTextFile, parseImportText, serializeExport } from "../storage/exportImport";
import { isAppState, normalizeAppState, type AppState } from "./appState";
import { appStateAtom, errorAtom, noticeAtom, planOptionsAtom } from "./appAtoms";

const buildExportFilename = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `eat-planner-export-${year}${month}${day}.json`;
};

type StoreLike = ReturnType<typeof getDefaultStore>;

const defaultStore = getDefaultStore();
const withStore = (store?: StoreLike) => store ?? defaultStore;

export const exportToFile = (store?: StoreLike) => {
  const s = withStore(store);
  const content = serializeExport(s.get(appStateAtom));
  downloadTextFile(buildExportFilename(), content);
};

export const copyToClipboard = async (store?: StoreLike) => {
  const s = withStore(store);
  try {
    const content = serializeExport(s.get(appStateAtom));
    await navigator.clipboard.writeText(content);
    s.set(errorAtom, null);
    s.set(noticeAtom, "Export copied to clipboard.");
  } catch {
    s.set(errorAtom, "Clipboard write failed. Use Export File instead.");
    s.set(noticeAtom, null);
  }
};

export const importFromText = (text: string, store?: StoreLike) => {
  const s = withStore(store);
  const imported = parseImportText<AppState>(text, isAppState);
  s.set(appStateAtom, normalizeAppState(imported));
  s.set(planOptionsAtom, []);
  s.set(errorAtom, null);
  s.set(noticeAtom, "Import completed.");
};

export const importFromFile = async (file: File, store?: StoreLike) => {
  const text = await file.text();
  importFromText(text, store);
};

export const pasteFromClipboard = async (store?: StoreLike) => {
  const s = withStore(store);
  try {
    const text = await navigator.clipboard.readText();
    importFromText(text, store);
  } catch {
    s.set(errorAtom, "Clipboard read failed. Use Import File instead.");
    s.set(noticeAtom, null);
  }
};
