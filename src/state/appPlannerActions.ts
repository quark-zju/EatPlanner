import { getDefaultStore } from "jotai";
import { solvePlanOptions } from "../core";
import {
  appStateAtom,
  errorAtom,
  noticeAtom,
  plannerMessageAtom,
  planOptionsAtom,
  solvingAtom,
} from "./appAtoms";

type StoreLike = ReturnType<typeof getDefaultStore>;

const defaultStore = getDefaultStore();
const withStore = (store?: StoreLike) => store ?? defaultStore;

export const generatePlanOptions = async (
  params?: { localAvoidFoodIds?: string[] },
  store?: StoreLike
) => {
  const s = withStore(store);
  s.set(solvingAtom, true);
  s.set(errorAtom, null);
  s.set(noticeAtom, null);
  s.set(plannerMessageAtom, null);

  try {
    if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
      throw new Error(
        "SharedArrayBuffer is unavailable. Reload after service worker registration or ensure COOP/COEP headers."
      );
    }

    const state = s.get(appStateAtom);
    const localAvoidSet = new Set(params?.localAvoidFoodIds ?? []);
    const localAvoid = Array.from(localAvoidSet);
    const result = await solvePlanOptions(
      {
        foods: state.foods,
        pantry: state.pantry,
        goal: state.goal,
        constraints: {
          avoidFoodIds: localAvoid,
        },
      },
      3
    );

    s.set(planOptionsAtom, result);
    if (result.length === 0) {
      s.set(
        plannerMessageAtom,
        "No feasible plan found for the current goals and pantry. Try widening ranges or adding stock."
      );
    }
  } catch (err) {
    s.set(errorAtom, err instanceof Error ? err.message : "Solver failed.");
  } finally {
    s.set(solvingAtom, false);
  }
};
