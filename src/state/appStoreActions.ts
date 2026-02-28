import { getDefaultStore } from "jotai";
import type { PlanOption } from "../core";
import {
  driveBusyAtom,
  driveConnectedAtom,
  errorAtom,
  noticeAtom,
  planOptionsAtom,
  solvingAtom,
} from "./appAtoms";

const store = getDefaultStore();

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
