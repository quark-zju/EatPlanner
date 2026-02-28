import { getDefaultStore } from "jotai";
import type { PlanOption } from "../core";
import { appStateAtom, driveBusyAtom, driveConnectedAtom, errorAtom, noticeAtom, planOptionsAtom, solvingAtom } from "./appAtoms";
import { defaultAppState } from "./appState";

const store = getDefaultStore();

export const resetInventory = () => {
  const current = store.get(appStateAtom);
  store.set(appStateAtom, {
    ...current,
    foods: defaultAppState.foods,
    pantry: defaultAppState.pantry,
  });
  store.set(noticeAtom, "Inventory reset to default.");
};

export const resetHistory = () => {
  const current = store.get(appStateAtom);
  store.set(appStateAtom, {
    ...current,
    history: { byDate: {} },
  });
  store.set(noticeAtom, "History cleared.");
};

export const resetGoals = () => {
  const current = store.get(appStateAtom);
  store.set(appStateAtom, {
    ...current,
    goal: defaultAppState.goal,
  });
  store.set(noticeAtom, "Goals reset to default.");
};

export const clearMessages = () => {
  store.set(errorAtom, null);
  store.set(noticeAtom, null);
};

export const setAppError = (message: string | null) => {
  store.set(errorAtom, message);
  if (message) {
    store.set(noticeAtom, null);
  }
};

export const setAppNotice = (message: string | null) => {
  store.set(noticeAtom, message);
  if (message) {
    store.set(errorAtom, null);
  }
};

export const setPlanOptions = (options: PlanOption[]) => {
  store.set(planOptionsAtom, options);
};

export const setSolving = (value: boolean) => {
  store.set(solvingAtom, value);
};

export const setDriveConnected = (value: boolean) => {
  store.set(driveConnectedAtom, value);
};

export const setDriveBusy = (value: boolean) => {
  store.set(driveBusyAtom, value);
};
