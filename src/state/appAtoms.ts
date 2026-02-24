import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Goal, PantryItem, PlanOption } from "../core";
import { isGoogleDriveConnected } from "../storage/googleDrive";
import {
  APP_STATE_STORAGE_KEY,
  defaultAppStateMap,
  fromAppStateMap,
  getRollingWindowStartISO,
  getFoodIcon,
  isAppState,
  normalizeAppState,
  shiftLocalDateISO,
  toAppStateMap,
  type AppState,
  type AppStateMap,
  type DraftItem,
  type LocalDateISO,
  type UiTab,
} from "./appState";
import { calculateDraftPrice, calculateDraftTotals, toRemainingGoal } from "./appDraftMath";

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
export const plannerMessageAtom = atom<string | null>(null);
export const plannerContextItemsAtom = atom<DraftItem[]>([]);
export const plannerContextDisplayItemsAtom = atom((get) =>
  get(plannerContextItemsAtom).filter((item) => item.quantity > 0)
);
export const driveConnectedAtom = atom(isGoogleDriveConnected());
export const driveBusyAtom = atom(false);
export const activeTabAtom = atom<UiTab>("today");
export const historyWindowStartAtom = atom<LocalDateISO>(getRollingWindowStartISO());
export const selectedHistoryDateAtom = atom<LocalDateISO | undefined>(undefined);

export const historyWindowRangeAtom = atom((get) => {
  const startISO = get(historyWindowStartAtom);
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

export const plannerRemainingGoalAtom = atom((get) =>
  toRemainingGoal(get(appStateAtom).goal, get(plannerContextItemsAtom))
);

export const plannerContextMessageAtom = atom((get) => {
  const items = get(plannerContextDisplayItemsAtom);
  if (items.length === 0) {
    return null;
  }
  const parts = items.map(
    (item) =>
      `${getFoodIcon(item.foodIconSnapshot)} ${item.foodNameSnapshot} x ${item.quantity}`
  );
  return `Given ${parts.join(", ")} were already eaten, plans for the rest of the day:`;
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

export type { AppState };
