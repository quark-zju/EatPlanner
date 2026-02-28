import { getDefaultStore } from "jotai";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  loadFromGoogleDrive,
  saveToGoogleDrive,
} from "../storage/googleDrive";
import { serializeExport } from "../storage/exportImport";
import {
  appStateAtom,
  driveBusyAtom,
  driveConnectedAtom,
  errorAtom,
  noticeAtom,
} from "./appAtoms";
import { importFromText } from "./appDataActions";
import { shouldLog } from "../core/debug";

const DEFAULT_DRIVE_CLIENT_ID =
  "775455628972-haf8lsiavs1u6ncpui8f20ac0orkh4nf.apps.googleusercontent.com";
const logDrive = (...args: unknown[]) => {
  if (shouldLog) {
    console.log("[drive-atom]", ...args);
  }
};

type StoreLike = ReturnType<typeof getDefaultStore>;

const defaultStore = getDefaultStore();
const withStore = (store?: StoreLike) => store ?? defaultStore;

export const connectDrive = async (store?: StoreLike) => {
  const s = withStore(store);
  logDrive("connect:start");
  s.set(driveBusyAtom, true);
  s.set(errorAtom, null);
  s.set(noticeAtom, null);
  try {
    const status = await connectGoogleDrive(DEFAULT_DRIVE_CLIENT_ID);
    logDrive("connect:googleStatus", status);
    if (status === "connected") {
      s.set(driveConnectedAtom, true);
      logDrive("connect:setConnectedTrue");
      s.set(noticeAtom, "Connected to Google Drive.");
    } else {
      s.set(noticeAtom, "Redirecting to Google sign-in...");
    }
  } catch (err) {
    logDrive("connect:error", err);
    s.set(errorAtom, err instanceof Error ? err.message : "Google Drive connect failed.");
  } finally {
    logDrive("connect:done");
    s.set(driveBusyAtom, false);
  }
};

export const disconnectDrive = (store?: StoreLike) => {
  const s = withStore(store);
  logDrive("disconnect:start");
  disconnectGoogleDrive();
  s.set(driveConnectedAtom, false);
  s.set(noticeAtom, "Disconnected from Google Drive.");
  logDrive("disconnect:done");
};

export const saveToDrive = async (store?: StoreLike) => {
  const s = withStore(store);
  s.set(driveBusyAtom, true);
  s.set(errorAtom, null);
  s.set(noticeAtom, null);
  try {
    await saveToGoogleDrive(DEFAULT_DRIVE_CLIENT_ID, serializeExport(s.get(appStateAtom)));
    s.set(noticeAtom, "Saved to Google Drive.");
  } catch (err) {
    s.set(errorAtom, err instanceof Error ? err.message : "Google Drive save failed.");
  } finally {
    s.set(driveBusyAtom, false);
  }
};

export const loadFromDrive = async (store?: StoreLike) => {
  const s = withStore(store);
  s.set(driveBusyAtom, true);
  s.set(errorAtom, null);
  s.set(noticeAtom, null);
  try {
    const content = await loadFromGoogleDrive(DEFAULT_DRIVE_CLIENT_ID);
    importFromText(content, store);
    s.set(noticeAtom, "Loaded from Google Drive.");
  } catch (err) {
    s.set(errorAtom, err instanceof Error ? err.message : "Google Drive load failed.");
  } finally {
    s.set(driveBusyAtom, false);
  }
};
