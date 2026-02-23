import { getDefaultStore } from "jotai";
import type { Goal } from "../core";
import { shiftLocalDateISO, getRollingWindowStartISO, type LocalDateISO } from "./appState";
import { appStateAtom, historyWindowStartAtom, selectedHistoryDateAtom } from "./appAtoms";

const defaultStore = getDefaultStore();
type StoreLike = ReturnType<typeof getDefaultStore>;
const withStore = (store?: StoreLike) => store ?? defaultStore;

export const setHistoryWindow = (
  direction: "prev" | "next" | "today",
  store?: StoreLike
) => {
  const s = withStore(store);
  let nextStart = s.get(historyWindowStartAtom);
  if (direction === "prev") {
    nextStart = shiftLocalDateISO(nextStart, -30);
  } else if (direction === "next") {
    nextStart = shiftLocalDateISO(nextStart, 30);
  } else {
    nextStart = getRollingWindowStartISO();
  }

  s.set(historyWindowStartAtom, nextStart);
  s.set(selectedHistoryDateAtom, undefined);
};

export const setSelectedHistoryDate = (dateISO: LocalDateISO | undefined, store?: StoreLike) => {
  const s = withStore(store);
  s.set(selectedHistoryDateAtom, dateISO);
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
