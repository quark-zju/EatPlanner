import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import "./App.css";
import { solvePlanOptions } from "./core";
import {
  downloadTextFile,
  parseImportText,
  serializeExport,
} from "./storage/exportImport";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  loadFromGoogleDrive,
  saveToGoogleDrive,
} from "./storage/googleDrive";
import {
  addFoodAtom,
  appStateAtom,
  clearMessagesAtom,
  driveBusyAtom,
  driveConnectedAtom,
  errorAtom,
  getPantryByFoodAtom,
  noticeAtom,
  planOptionsAtom,
  removeFoodAtom,
  setDriveBusyAtom,
  setDriveConnectedAtom,
  setErrorAtom,
  setImportedStateAtom,
  setNoticeAtom,
  setPlanOptionsAtom,
  setSolvingAtom,
  solvingAtom,
  toggleConstraintAtom,
  updateFoodAtom,
  updateGoalAtom,
  updateNutritionAtom,
  updateStockAtom,
  type AppState,
} from "./state/appAtoms";
import { isAppState } from "./state/appState";

const DEFAULT_DRIVE_CLIENT_ID =
  "775455628972-haf8lsiavs1u6ncpui8f20ac0orkh4nf.apps.googleusercontent.com";

const formatPrice = (option: { priceLowerBound: number; hasUnknownPrice: boolean }) => {
  const base = option.priceLowerBound.toFixed(2);
  return option.hasUnknownPrice ? `${base}+` : base;
};

export default function App() {
  const state = useAtomValue(appStateAtom);
  const options = useAtomValue(planOptionsAtom);
  const isSolving = useAtomValue(solvingAtom);
  const error = useAtomValue(errorAtom);
  const notice = useAtomValue(noticeAtom);
  const driveConnected = useAtomValue(driveConnectedAtom);
  const driveBusy = useAtomValue(driveBusyAtom);
  const pantryByFood = useAtomValue(getPantryByFoodAtom);

  const setImportedState = useSetAtom(setImportedStateAtom);
  const addFood = useSetAtom(addFoodAtom);
  const removeFood = useSetAtom(removeFoodAtom);
  const updateFood = useSetAtom(updateFoodAtom);
  const updateNutrition = useSetAtom(updateNutritionAtom);
  const updateStock = useSetAtom(updateStockAtom);
  const updateGoal = useSetAtom(updateGoalAtom);
  const toggleConstraint = useSetAtom(toggleConstraintAtom);

  const clearMessages = useSetAtom(clearMessagesAtom);
  const setError = useSetAtom(setErrorAtom);
  const setNotice = useSetAtom(setNoticeAtom);
  const setPlanOptions = useSetAtom(setPlanOptionsAtom);
  const setSolving = useSetAtom(setSolvingAtom);
  const setDriveConnected = useSetAtom(setDriveConnectedAtom);
  const setDriveBusy = useSetAtom(setDriveBusyAtom);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const solve = async () => {
    setSolving(true);
    clearMessages();
    try {
      if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
        throw new Error(
          "SharedArrayBuffer is unavailable. Reload after service worker registration or ensure COOP/COEP headers."
        );
      }
      const result = await solvePlanOptions(
        {
          foods: state.foods,
          pantry: state.pantry,
          goal: state.goal,
          constraints: state.constraints,
        },
        3
      );
      setPlanOptions(result);
      if (result.length === 0) {
        setError(
          "No feasible plan found for the current goals and pantry. Try widening ranges or adding stock."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Solver failed.");
    } finally {
      setSolving(false);
    }
  };

  const applyImportedState = (imported: AppState) => {
    setImportedState(imported);
  };

  const exportStateToFile = () => {
    const content = serializeExport(state);
    downloadTextFile("eat-planner-export.json", content);
  };

  const copyStateToClipboard = async () => {
    try {
      const content = serializeExport(state);
      await navigator.clipboard.writeText(content);
      setError(null);
      setNotice("Export copied to clipboard.");
    } catch {
      setError("Clipboard write failed. Use Export File instead.");
      setNotice(null);
    }
  };

  const importFromText = (text: string) => {
    const imported = parseImportText<AppState>(text, isAppState);
    applyImportedState(imported);
  };

  const importFromFile = async (file: File) => {
    const text = await file.text();
    importFromText(text);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      importFromText(text);
    } catch {
      setError("Clipboard read failed. Use Import File instead.");
      setNotice(null);
    }
  };

  const connectDrive = async () => {
    setDriveBusy(true);
    clearMessages();
    try {
      await connectGoogleDrive(DEFAULT_DRIVE_CLIENT_ID);
      setDriveConnected(true);
      setNotice("Connected to Google Drive.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Drive connect failed.");
    } finally {
      setDriveBusy(false);
    }
  };

  const disconnectDrive = () => {
    disconnectGoogleDrive();
    setDriveConnected(false);
    setNotice("Disconnected from Google Drive.");
  };

  const saveDrive = async () => {
    setDriveBusy(true);
    clearMessages();
    try {
      await saveToGoogleDrive(DEFAULT_DRIVE_CLIENT_ID, serializeExport(state));
      setNotice("Saved to Google Drive.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Drive save failed.");
    } finally {
      setDriveBusy(false);
    }
  };

  const loadDrive = async () => {
    setDriveBusy(true);
    clearMessages();
    try {
      const content = await loadFromGoogleDrive(DEFAULT_DRIVE_CLIENT_ID);
      importFromText(content);
      setNotice("Loaded from Google Drive.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Drive load failed.");
    } finally {
      setDriveBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Eat Planner</h1>
          <p>Plan meals around the food you already have.</p>
        </div>
        <button className="primary" onClick={solve} disabled={isSolving}>
          {isSolving ? "Solving..." : "Generate Plans"}
        </button>
      </header>

      <main className="app__grid">
        <section className="card">
          <div className="card__header">
            <h2>Storage</h2>
            <button className="ghost" onClick={exportStateToFile}>
              Export File
            </button>
          </div>
          <div className="storage-actions">
            <button className="ghost" onClick={copyStateToClipboard} type="button">
              Copy JSON
            </button>
            <button
              className="ghost"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Import File
            </button>
            <button className="ghost" onClick={pasteFromClipboard} type="button">
              Paste JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden-input"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                try {
                  await importFromFile(file);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Import failed.");
                } finally {
                  event.target.value = "";
                }
              }}
            />
          </div>
          <div className="drive-box">
            <div className="storage-actions">
              {!driveConnected && (
                <button className="ghost" onClick={connectDrive} disabled={driveBusy}>
                  Connect Drive
                </button>
              )}
              {driveConnected && (
                <button className="ghost" onClick={disconnectDrive} disabled={driveBusy}>
                  Disconnect Drive
                </button>
              )}
              <button className="ghost" onClick={saveDrive} disabled={driveBusy} type="button">
                Save to Drive
              </button>
              <button className="ghost" onClick={loadDrive} disabled={driveBusy} type="button">
                Load from Drive
              </button>
            </div>
          </div>
          <p className="hint">
            Export uses a versioned schema. Google Drive sync writes to app data.
          </p>
          <p className="hint">
            Privacy Policy:{" "}
            <a href="/privacy.html" target="_blank" rel="noreferrer">
              /privacy.html
            </a>
          </p>
          {notice && <p className="notice">{notice}</p>}
        </section>

        <section className="card">
          <h2>Goals</h2>
          <div className="goal-grid">
            {(["carbs", "fat", "protein"] as const).map((macro) => (
              <div className="goal-row" key={macro}>
                <label className="macro-label">{macro}</label>
                <input
                  type="number"
                  value={state.goal[macro].min}
                  onChange={(event) =>
                    updateGoal({ key: macro, field: "min", value: Number(event.target.value) })
                  }
                />
                <span>to</span>
                <input
                  type="number"
                  value={state.goal[macro].max}
                  onChange={(event) =>
                    updateGoal({ key: macro, field: "max", value: Number(event.target.value) })
                  }
                />
                <span>g</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <h2>Pantry Foods</h2>
            <button className="ghost" onClick={() => addFood()}>
              Add Food
            </button>
          </div>
          <div className="table">
            <div className="table__row table__head">
              <span>Name</span>
              <span>Unit</span>
              <span>Carbs</span>
              <span>Fat</span>
              <span>Protein</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Prefs</span>
            </div>
            {state.foods.map((food) => {
              const stock = pantryByFood.get(food.id)?.stock ?? 0;
              return (
                <div className="table__row" key={food.id}>
                  <input
                    value={food.name}
                    onChange={(event) =>
                      updateFood({ foodId: food.id, updates: { name: event.target.value } })
                    }
                  />
                  <input
                    value={food.unit}
                    onChange={(event) =>
                      updateFood({ foodId: food.id, updates: { unit: event.target.value } })
                    }
                  />
                  <input
                    type="number"
                    value={food.nutritionPerUnit.carbs}
                    onChange={(event) =>
                      updateNutrition({
                        foodId: food.id,
                        updates: { carbs: Number(event.target.value) },
                      })
                    }
                  />
                  <input
                    type="number"
                    value={food.nutritionPerUnit.fat}
                    onChange={(event) =>
                      updateNutrition({
                        foodId: food.id,
                        updates: { fat: Number(event.target.value) },
                      })
                    }
                  />
                  <input
                    type="number"
                    value={food.nutritionPerUnit.protein}
                    onChange={(event) =>
                      updateNutrition({
                        foodId: food.id,
                        updates: { protein: Number(event.target.value) },
                      })
                    }
                  />
                  <input
                    type="number"
                    value={food.price ?? ""}
                    placeholder="?"
                    onChange={(event) =>
                      updateFood({
                        foodId: food.id,
                        updates: {
                          price:
                            event.target.value === "" ? undefined : Number(event.target.value),
                        },
                      })
                    }
                  />
                  <input
                    type="text"
                    value={stock}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateStock({
                        foodId: food.id,
                        stock: value === "inf" ? "inf" : Number(value),
                      });
                    }}
                  />
                  <div className="prefs">
                    <label>
                      <input
                        type="checkbox"
                        checked={state.constraints.preferFoodIds?.includes(food.id)}
                        onChange={() =>
                          toggleConstraint({ type: "preferFoodIds", foodId: food.id })
                        }
                      />
                      Prefer
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={state.constraints.avoidFoodIds?.includes(food.id)}
                        onChange={() =>
                          toggleConstraint({ type: "avoidFoodIds", foodId: food.id })
                        }
                      />
                      Avoid
                    </label>
                    <button className="link" onClick={() => removeFood(food.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="hint">
            Stock accepts numbers or <code>inf</code> for restaurant-style items.
          </p>
        </section>

        <section className="card">
          <h2>Plan Options</h2>
          {error && <p className="error">{error}</p>}
          {!error && options.length === 0 && <p className="hint">Generate plans to see results.</p>}
          <div className="options">
            {options.map((option, index) => (
              <article className="option" key={index}>
                <header>
                  <h3>Option {index + 1}</h3>
                  <span className="price">${formatPrice(option)} total</span>
                </header>
                <div className="option__body">
                  <div>
                    <h4>Servings</h4>
                    <ul>
                      {Object.entries(option.servings).map(([foodId, amount]) => {
                        if (amount <= 0) {
                          return null;
                        }
                        const food = state.foods.find((f) => f.id === foodId);
                        return (
                          <li key={foodId}>
                            {food?.name ?? foodId}: {amount} {food?.unit}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <h4>Totals</h4>
                    <p>Carbs: {option.totals.carbs.toFixed(1)} g</p>
                    <p>Fat: {option.totals.fat.toFixed(1)} g</p>
                    <p>Protein: {option.totals.protein.toFixed(1)} g</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
