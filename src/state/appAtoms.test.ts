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
    const draftActions = await import("./appDraftActions");
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

    draftActions.selectPlanOptionToDraft(
      {
      optionIndex: 0,
      dateISO: "2026-02-22",
      },
      store
    );

    let state = store.get(atoms.appStateAtom);
    expect(state.todayDraft.items.length).toBe(2);
    expect(state.todayDraft.items[0].foodNameSnapshot).toBe("Rice");

    draftActions.updateDraftQuantity({ foodId: "rice", quantity: 1.5 }, store);
    draftActions.submitDraftToHistory(store);

    state = store.get(atoms.appStateAtom);
    expect(state.history.byDate["2026-02-22"]).toBeDefined();
    expect(state.history.byDate["2026-02-22"].items.find((i) => i.foodId === "rice")?.quantity).toBe(
      1.5
    );

    const firstSubmittedAt = state.history.byDate["2026-02-22"].submittedAtISO;

    draftActions.updateDraftQuantity({ foodId: "rice", quantity: 2 }, store);
    draftActions.submitDraftToHistory(store);

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
    const inventoryActions = await import("./appInventoryActions");
    const store = createStore();

    store.set(atoms.appStateAtom, defaultAppState as AppState);

    inventoryActions.moveFoodsToTop(["olive-oil"], store);
    let state = store.get(atoms.appStateAtom);
    expect(state.foods[0].id).toBe("olive-oil");

    inventoryActions.removeFoods(["olive-oil", "rice"], store);
    state = store.get(atoms.appStateAtom);
    expect(state.foods.map((food) => food.id)).toEqual(["chicken"]);
    expect(state.pantry.map((item) => item.foodId)).toEqual(["chicken"]);
  });

  it("adds a new food from inventory placeholder row payload", async () => {
    const atoms = await import("./appAtoms");
    const inventoryActions = await import("./appInventoryActions");
    const store = createStore();

    store.set(atoms.appStateAtom, defaultAppState as AppState);
    inventoryActions.addFoodFromEditor({
      name: "Blueberry",
      icon: "",
      unit: "cup",
      carbs: 21,
      fat: 0.5,
      protein: 1,
      price: 3.2,
      stock: 2,
    }, store);

    const state = store.get(atoms.appStateAtom);
    const added = state.foods[state.foods.length - 1];
    expect(added.name).toBe("Blueberry");
    expect(added.unit).toBe("cup");
    expect(added.icon).toBe("🫐");
    expect(state.pantry[state.pantry.length - 1].stock).toBe(2);
  });

  it("loads historical foods into draft when selecting a saved date", async () => {
    const atoms = await import("./appAtoms");
    const draftActions = await import("./appDraftActions");
    const store = createStore();

    store.set(atoms.appStateAtom, {
      ...defaultAppState,
      history: {
        byDate: {
          "2026-02-20": {
            dateISO: "2026-02-20",
            submittedAtISO: "2026-02-20T12:00:00.000Z",
            goalSnapshot: defaultAppState.goal,
            items: [
              {
                foodId: "rice",
                foodNameSnapshot: "Rice",
                unitSnapshot: "serving",
                nutritionPerUnitSnapshot: { carbs: 45, fat: 0.4, protein: 4 },
                quantity: 2,
                pricePerUnitSnapshot: 1.2,
              },
            ],
            totals: { carbs: 90, fat: 0.8, protein: 8 },
            priceLowerBound: 2.4,
            hasUnknownPrice: false,
            source: "planner-submit",
          },
        },
      },
    });

    draftActions.setDraftDate("2026-02-20", store);
    const state = store.get(atoms.appStateAtom);
    expect(state.todayDraft.draftDateISO).toBe("2026-02-20");
    expect(state.todayDraft.items.length).toBe(1);
    expect(state.todayDraft.items[0].foodId).toBe("rice");
    expect(state.todayDraft.items[0].quantity).toBe(2);
  });
});
