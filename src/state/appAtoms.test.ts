import { createStore } from "jotai/vanilla";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultAppState, type AppState } from "./appState";

const installLocalStorageMock = () => {
  const memory = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => {
      memory.clear();
    },
    key: (_index: number) => null,
    get length() {
      return memory.size;
    },
  } as Storage;

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
};

describe("appAtoms history and draft flow", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("creates and replaces a history day record from draft submit", async () => {
    const atoms = await import("./appAtoms");
    const store = createStore();

    store.set(atoms.appStateAtom, defaultAppState as AppState);
    store.set(atoms.planOptionsAtom, [
      {
        status: "sat",
        servings: { rice: 1, chicken: 1, "olive-oil": 0 },
        totals: { carbs: 45, fat: 3.4, protein: 35 },
        priceLowerBound: 3.7,
        hasUnknownPrice: false,
      },
    ]);

    store.set(atoms.selectPlanOptionToDraftAtom, {
      optionIndex: 0,
      dateISO: "2026-02-22",
    });

    let state = store.get(atoms.appStateAtom);
    expect(state.todayDraft.items.length).toBe(2);
    expect(state.todayDraft.items[0].foodNameSnapshot).toBe("Rice");

    store.set(atoms.updateDraftQuantityAtom, { foodId: "rice", quantity: 1.5 });
    store.set(atoms.submitDraftToHistoryAtom);

    state = store.get(atoms.appStateAtom);
    expect(state.history.byDate["2026-02-22"]).toBeDefined();
    expect(state.history.byDate["2026-02-22"].items.find((i) => i.foodId === "rice")?.quantity).toBe(
      1.5
    );

    const firstSubmittedAt = state.history.byDate["2026-02-22"].submittedAtISO;

    store.set(atoms.updateDraftQuantityAtom, { foodId: "rice", quantity: 2 });
    store.set(atoms.submitDraftToHistoryAtom);

    state = store.get(atoms.appStateAtom);
    const replaced = state.history.byDate["2026-02-22"];
    expect(replaced.items.find((i) => i.foodId === "rice")?.quantity).toBe(2);
    expect(replaced.submittedAtISO >= firstSubmittedAt).toBe(true);
  });

  it("moves history window by 30 days", async () => {
    const atoms = await import("./appAtoms");
    const actions = await import("./appDomainActions");
    const store = createStore();

    store.set(atoms.appStateAtom, {
      ...defaultAppState,
      ui: {
        ...defaultAppState.ui,
        historyWindowStartISO: "2026-02-01",
      },
    });

    actions.setHistoryWindow("prev", store);
    expect(store.get(atoms.appStateAtom).ui.historyWindowStartISO).toBe("2026-01-02");

    actions.setHistoryWindow("next", store);
    expect(store.get(atoms.appStateAtom).ui.historyWindowStartISO).toBe("2026-02-01");
  });

  it("moves selected foods to top and deletes selected foods", async () => {
    const atoms = await import("./appAtoms");
    const store = createStore();

    store.set(atoms.appStateAtom, defaultAppState as AppState);

    store.set(atoms.moveFoodsToTopAtom, ["olive-oil"]);
    let state = store.get(atoms.appStateAtom);
    expect(state.foods[0].id).toBe("olive-oil");

    store.set(atoms.removeFoodsAtom, ["olive-oil", "rice"]);
    state = store.get(atoms.appStateAtom);
    expect(state.foods.map((food) => food.id)).toEqual(["chicken"]);
    expect(state.pantry.map((item) => item.foodId)).toEqual(["chicken"]);
  });

  it("adds a new food from inventory placeholder row payload", async () => {
    const atoms = await import("./appAtoms");
    const store = createStore();

    store.set(atoms.appStateAtom, defaultAppState as AppState);
    store.set(atoms.addFoodFromEditorAtom, {
      name: "Blueberry",
      icon: "",
      unit: "cup",
      carbs: 21,
      fat: 0.5,
      protein: 1,
      price: 3.2,
      stock: 2,
    });

    const state = store.get(atoms.appStateAtom);
    const added = state.foods[state.foods.length - 1];
    expect(added.name).toBe("Blueberry");
    expect(added.unit).toBe("cup");
    expect(added.icon).toBe("🫐");
    expect(state.pantry[state.pantry.length - 1].stock).toBe(2);
  });
});
