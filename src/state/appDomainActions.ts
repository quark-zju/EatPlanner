import { getDefaultStore } from "jotai";
import type { Goal } from "../core";
import { shiftLocalDateISO, getRollingWindowStartISO, type LocalDateISO } from "./appState";
import { appStateAtom } from "./appAtoms";

const defaultStore = getDefaultStore();
type StoreLike = ReturnType<typeof getDefaultStore>;
const withStore = (store?: StoreLike) => store ?? defaultStore;

export const setHistoryWindow = (
  direction: "prev" | "next" | "today",
  store?: StoreLike
) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  let nextStart = state.ui.historyWindowStartISO;
  if (direction === "prev") {
    nextStart = shiftLocalDateISO(nextStart, -30);
  } else if (direction === "next") {
    nextStart = shiftLocalDateISO(nextStart, 30);
  } else {
    nextStart = getRollingWindowStartISO();
  }

  s.set(appStateAtom, {
    ...state,
    ui: {
      ...state.ui,
      historyWindowStartISO: nextStart,
      selectedHistoryDateISO: undefined,
    },
  });
};

export const setSelectedHistoryDate = (dateISO: LocalDateISO | undefined, store?: StoreLike) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  s.set(appStateAtom, {
    ...state,
    ui: {
      ...state.ui,
      selectedHistoryDateISO: dateISO,
    },
  });
};

export const setDraftDate = (dateISO: LocalDateISO, store?: StoreLike) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  s.set(appStateAtom, {
    ...state,
    todayDraft: {
      ...state.todayDraft,
      draftDateISO: dateISO,
    },
  });
};

export const updateGoal = (
  payload: { key: keyof Goal; field: "min" | "max"; value: number },
  store?: StoreLike
) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  s.set(appStateAtom, {
    ...state,
    goal: {
      ...state.goal,
      [payload.key]: {
        ...state.goal[payload.key],
        [payload.field]: payload.value,
      },
    },
  });
};

export const toggleConstraint = (
  payload: { type: "avoidFoodIds" | "preferFoodIds"; foodId: string },
  store?: StoreLike
) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  const list = new Set(state.constraints[payload.type] ?? []);
  if (list.has(payload.foodId)) {
    list.delete(payload.foodId);
  } else {
    list.add(payload.foodId);
  }

  s.set(appStateAtom, {
    ...state,
    constraints: { ...state.constraints, [payload.type]: Array.from(list) },
  });
};
