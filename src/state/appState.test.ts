import { describe, expect, it } from "vitest";
import { defaultAppState, normalizeAppState, type AppState } from "./appState";

describe("normalizeAppState", () => {
  it("fills new ui/history/todayDraft fields for legacy-shaped payloads", () => {
    const legacy = {
      foods: defaultAppState.foods,
      pantry: defaultAppState.pantry,
      goal: defaultAppState.goal,
      constraints: defaultAppState.constraints,
    } as AppState;

    const normalized = normalizeAppState(legacy);

    expect(normalized.ui.activeTab).toBe("today");
    expect(normalized.ui.historyWindowStartISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(normalized.todayDraft.items).toEqual([]);
    expect(normalized.history.byDate).toEqual({});
  });
});
