import { describe, expect, it } from "vitest";
import { defaultAppState, normalizeAppState, type AppState } from "./appState";

describe("normalizeAppState", () => {
  it("fills history/todayDraft fields for legacy-shaped payloads", () => {
    const legacy = {
      foods: defaultAppState.foods,
      pantry: defaultAppState.pantry,
      goal: defaultAppState.goal,
    } as AppState;

    const normalized = normalizeAppState(legacy);

    expect(normalized.todayDraft.items).toEqual([]);
    expect(normalized.history.byDate).toEqual({});
  });
});
