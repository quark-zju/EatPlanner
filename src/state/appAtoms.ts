import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { solvePlanOptions } from "../core";
import type {
  PantryItem,
  PlanConstraints,
  PlanOption,
} from "../core";
import {
  downloadTextFile,
  parseImportText,
  serializeExport,
} from "../storage/exportImport";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  isGoogleDriveConnected,
  loadFromGoogleDrive,
  saveToGoogleDrive,
} from "../storage/googleDrive";
import {
  APP_STATE_STORAGE_KEY,
  defaultAppStateMap,
  fromAppStateMap,
  isAppState,
  normalizeAppState,
  shiftLocalDateISO,
  toAppStateMap,
  type AppState,
  type AppStateMap,
  type LocalDateISO,
  type UiTab,
} from "./appState";
import { calculateDraftPrice } from "./appDraftMath";

const DEFAULT_DRIVE_CLIENT_ID =
  "775455628972-haf8lsiavs1u6ncpui8f20ac0orkh4nf.apps.googleusercontent.com";
const EXPORT_FILENAME = "eat-planner-export.json";
const debugDrive = import.meta.env.DEV && import.meta.env.MODE !== "test";
const logDrive = (...args: unknown[]) => {
  if (debugDrive) {
    console.log("[drive-atom]", ...args);
  }
};


const appStateMapStorage = {
  getItem: (key: string, initialValue: AppStateMap): AppStateMap => {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return initialValue;
    }
    try {
      const parsed = JSON.parse(raw);
      if (isAppState(parsed)) {
        return toAppStateMap(parsed);
      }
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem: (key: string, newValue: AppStateMap) => {
    const plain = fromAppStateMap(newValue);
    localStorage.setItem(key, JSON.stringify(plain));
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
  },
};

export const appStateMapAtom = atomWithStorage<AppStateMap>(
  APP_STATE_STORAGE_KEY,
  defaultAppStateMap,
  appStateMapStorage,
  { getOnInit: true }
);

export const appStateAtom = atom(
  (get) => fromAppStateMap(get(appStateMapAtom)),
  (_get, set, nextState: AppState) => {
    set(appStateMapAtom, toAppStateMap(normalizeAppState(nextState)));
  }
);

export const planOptionsAtom = atom<PlanOption[]>([]);
export const solvingAtom = atom(false);
export const errorAtom = atom<string | null>(null);
export const noticeAtom = atom<string | null>(null);
export const driveConnectedAtom = atom(isGoogleDriveConnected());
export const driveBusyAtom = atom(false);

export const activeTabAtom = atom(
  (get) => get(appStateAtom).ui.activeTab,
  (get, set, tab: UiTab) => {
    const state = get(appStateAtom);
    set(appStateAtom, {
      ...state,
      ui: {
        ...state.ui,
        activeTab: tab,
      },
    });
  }
);

export const historyWindowRangeAtom = atom((get) => {
  const startISO = get(appStateAtom).ui.historyWindowStartISO;
  const endISO = shiftLocalDateISO(startISO, 29);
  return { startISO, endISO };
});

export const historyDaysInWindowAtom = atom((get) => {
  const state = get(appStateAtom);
  const { startISO, endISO } = get(historyWindowRangeAtom);

  return Object.entries(state.history.byDate)
    .filter(([dateISO]) => dateISO >= startISO && dateISO <= endISO)
    .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    .map(([dateISO, record]) => ({ dateISO, record }));
});

export const historyDayByDateAtom = (dateISO: LocalDateISO) =>
  atom((get) => get(appStateAtom).history.byDate[dateISO] ?? null);

export const historyAggregatesInWindowAtom = atom((get) => {
  return get(historyDaysInWindowAtom).reduce(
    (acc, entry) => {
      acc.carbs += entry.record.totals.carbs;
      acc.fat += entry.record.totals.fat;
      acc.protein += entry.record.totals.protein;
      acc.calories += entry.record.totals.calories ?? 0;
      acc.days += 1;
      return acc;
    },
    {
      carbs: 0,
      fat: 0,
      protein: 0,
      calories: 0,
      days: 0,
    }
  );
});

export const draftPriceSummaryAtom = atom((get) => {
  const items = get(appStateAtom).todayDraft.items;
  return calculateDraftPrice(items);
});



export const getPantryByFoodAtom = atom((get) => {
  const pantry = get(appStateAtom).pantry;
  const map = new Map<string, PantryItem>();
  pantry.forEach((item) => map.set(item.foodId, item));
  return map;
});

export const getConstraintsForFoodAtom = atom((get) => {
  const constraints = get(appStateAtom).constraints;
  return (foodId: string) => ({
    prefer: constraints.preferFoodIds?.includes(foodId) ?? false,
    avoid: constraints.avoidFoodIds?.includes(foodId) ?? false,
  });
});

export const generatePlanOptionsAtom = atom(null, async (get, set) => {
  set(solvingAtom, true);
  set(errorAtom, null);
  set(noticeAtom, null);

  try {
    if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
      throw new Error(
        "SharedArrayBuffer is unavailable. Reload after service worker registration or ensure COOP/COEP headers."
      );
    }

    const state = get(appStateAtom);
    const result = await solvePlanOptions(
      {
        foods: state.foods,
        pantry: state.pantry,
        goal: state.goal,
        constraints: state.constraints,
      },
      3
    );

    set(planOptionsAtom, result);
    if (result.length === 0) {
      set(
        errorAtom,
        "No feasible plan found for the current goals and pantry. Try widening ranges or adding stock."
      );
    }
  } catch (err) {
    set(errorAtom, err instanceof Error ? err.message : "Solver failed.");
  } finally {
    set(solvingAtom, false);
  }
});

export const solvePlanAtom = generatePlanOptionsAtom;

export const exportToFileAtom = atom(null, (get) => {
  const content = serializeExport(get(appStateAtom));
  downloadTextFile(EXPORT_FILENAME, content);
});

export const copyToClipboardAtom = atom(null, async (get, set) => {
  try {
    const content = serializeExport(get(appStateAtom));
    await navigator.clipboard.writeText(content);
    set(errorAtom, null);
    set(noticeAtom, "Export copied to clipboard.");
  } catch {
    set(errorAtom, "Clipboard write failed. Use Export File instead.");
    set(noticeAtom, null);
  }
});

export const importFromTextAtom = atom(null, (_get, set, text: string) => {
  const imported = parseImportText<AppState>(text, isAppState);
  set(appStateAtom, normalizeAppState(imported));
  set(planOptionsAtom, []);
  set(errorAtom, null);
  set(noticeAtom, "Import completed.");
});

export const importFromFileAtom = atom(null, async (_get, set, file: File) => {
  const text = await file.text();
  set(importFromTextAtom, text);
});

export const pasteFromClipboardAtom = atom(null, async (_get, set) => {
  try {
    const text = await navigator.clipboard.readText();
    set(importFromTextAtom, text);
  } catch {
    set(errorAtom, "Clipboard read failed. Use Import File instead.");
    set(noticeAtom, null);
  }
});

export const connectDriveAtom = atom(null, async (_get, set) => {
  logDrive("connect:start");
  set(driveBusyAtom, true);
  set(errorAtom, null);
  set(noticeAtom, null);
  try {
    const status = await connectGoogleDrive(DEFAULT_DRIVE_CLIENT_ID);
    logDrive("connect:googleStatus", status);
    if (status === "connected") {
      set(driveConnectedAtom, true);
      logDrive("connect:setConnectedTrue");
      set(noticeAtom, "Connected to Google Drive.");
    } else {
      set(noticeAtom, "Redirecting to Google sign-in...");
    }
  } catch (err) {
    logDrive("connect:error", err);
    set(errorAtom, err instanceof Error ? err.message : "Google Drive connect failed.");
  } finally {
    logDrive("connect:done");
    set(driveBusyAtom, false);
  }
});

export const disconnectDriveAtom = atom(null, (_get, set) => {
  logDrive("disconnect:start");
  disconnectGoogleDrive();
  set(driveConnectedAtom, false);
  set(noticeAtom, "Disconnected from Google Drive.");
  logDrive("disconnect:done");
});

export const saveToDriveAtom = atom(null, async (get, set) => {
  set(driveBusyAtom, true);
  set(errorAtom, null);
  set(noticeAtom, null);
  try {
    await saveToGoogleDrive(
      DEFAULT_DRIVE_CLIENT_ID,
      serializeExport(get(appStateAtom))
    );
    set(noticeAtom, "Saved to Google Drive.");
  } catch (err) {
    set(errorAtom, err instanceof Error ? err.message : "Google Drive save failed.");
  } finally {
    set(driveBusyAtom, false);
  }
});

export const loadFromDriveAtom = atom(null, async (_get, set) => {
  set(driveBusyAtom, true);
  set(errorAtom, null);
  set(noticeAtom, null);
  try {
    const content = await loadFromGoogleDrive(DEFAULT_DRIVE_CLIENT_ID);
    set(importFromTextAtom, content);
    set(noticeAtom, "Loaded from Google Drive.");
  } catch (err) {
    set(errorAtom, err instanceof Error ? err.message : "Google Drive load failed.");
  } finally {
    set(driveBusyAtom, false);
  }
});

export type { AppState, PlanConstraints };
