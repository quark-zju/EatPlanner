import { useRef } from "react";
import { useAtom } from "jotai";
import { useAtomValue } from "jotai";
import {
  appStateAtom,
  driveBusyAtom,
  driveConnectedAtom,
} from "../../state/appAtoms";
import {
  aiProviderAtom,
  geminiKeyAtom,
  openAiKeyAtom,
} from "../../state/appAiConfig";
import {
  copyToClipboard,
  exportToFile,
  importFromFile,
  pasteFromClipboard,
} from "../../state/appDataActions";
import {
  connectDrive,
  disconnectDrive,
  loadFromDrive,
  saveToDrive,
} from "../../state/appDriveActions";
import { setPlanOptionLimit, updateGoal } from "../../state/appDomainActions";
import { resetGoals, resetHistory, resetInventory, setAppError } from "../../state/appStoreActions";

export default function SettingsTab() {
  const state = useAtomValue(appStateAtom);
  const driveConnected = useAtomValue(driveConnectedAtom);
  const driveBusy = useAtomValue(driveBusyAtom);
  const [aiProvider, setAiProvider] = useAtom(aiProviderAtom);
  const [openAiKey, setOpenAiKey] = useAtom(openAiKeyAtom);
  const [geminiKey, setGeminiKey] = useAtom(geminiKeyAtom);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <section className="card">
        <div className="card__header">
          <h2>Goals</h2>
        </div>
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
          <h2>Plan Generation</h2>
        </div>
        <div className="goal-grid">
          <div className="setting-row">
            <label className="macro-label">Maximum Plan Count</label>
            <div className="setting-control">
              <input
                type="number"
                min={1}
                value={state.planOptionLimit}
                onChange={(event) => setPlanOptionLimit(Number(event.target.value))}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>Vision Recognition</h2>
        </div>
        <p className="hint">
          Select an AI provider to enable <b>Add from Photo</b> food recognition in the <b>Inventory</b> tab.<br />
          For best results, capture a nutrition label. Packaging or the food itself may work but can be less accurate.<br />
        </p>
        <div className="hint" style={{ marginTop: 10 }}>
          Model selection tips (Last updated: Feb 2026):
          <ul className="settings-note" style={{ marginTop: 5 }}>
            <li>Google Gemini API has <a href='https://ai.google.dev/gemini-api/docs/pricing' target="_blank" rel="noreferrer">free and paid tiers</a>. Free tier usage can be used for training.</li>
            <li>OpenAI GPT API is paid, although cheap. Usage is <a href='https://openai.com/api-data-privacy' target="_blank" rel="noreferrer">not used for training</a>.</li>
          </ul>
        </div>
        <div className="goal-grid" style={{ marginTop: 10 }} >
          <div className="setting-row">
            <label className="macro-label">Provider</label>
            <div className="setting-control">
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as any)}
              >
                <option value="none">Disabled</option>
                <option value="gemini">Google (Gemini-3-Flash)</option>
                <option value="openai">OpenAI (GPT-5-mini)</option>
              </select>
            </div>
          </div>

          {aiProvider === "openai" && (
            <div className="api-key-row">
              <label className="macro-label" htmlFor="openai-api-key">
                OpenAI API Key
              </label>
              <div className="api-key-control">
                <input
                  id="openai-api-key"
                  className="api-key-input"
                  type="password"
                  value={openAiKey}
                  placeholder="sk-..."
                  autoComplete="off"
                  onChange={(event) => setOpenAiKey(event.target.value)}
                />
                <button
                  className="ghost"
                  type="button"
                  onClick={() => setOpenAiKey("")}
                  disabled={openAiKey.length === 0}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {aiProvider === "gemini" && (
            <div className="api-key-row">
              <label className="macro-label" htmlFor="gemini-api-key">
                Gemini API Key
              </label>
              <div className="api-key-control">
                <input
                  id="gemini-api-key"
                  className="api-key-input"
                  type="password"
                  value={geminiKey}
                  placeholder="AIza..."
                  autoComplete="off"
                  onChange={(event) => setGeminiKey(event.target.value)}
                />
                <button
                  className="ghost"
                  type="button"
                  onClick={() => setGeminiKey("")}
                  disabled={geminiKey.length === 0}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {aiProvider !== "none" && (
          <ul className="hint settings-note">
            {aiProvider === "openai" && (
              <>
                <li>
                  Create a key at{" "}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                    platform.openai.com/api-keys
                  </a>
                </li>
                <li>
                  Add credit at{" "}
                  <a href="https://platform.openai.com/account/billing">
                    platform.openai.com/<wbr />account/<wbr />billing
                  </a>
                </li>
                <li>
                  Credits can expire per{" "}
                  <a href="https://openai.com/policies/service-credit-terms/#:~:text=expire">
                    OpenAI's terms
                  </a>
                  , so it’s best to add only a small amount.
                </li>
                <li>
                  If you have leftover credit, you can also use it at{" "}
                  <a href="https://platform.openai.com/chat">platform.openai.com/chat</a> for advanced
                  models and other features.
                </li>
              </>
            )}
            {aiProvider === "gemini" && (
              <li>
                Create a key at{" "}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                  aistudio.google.com/app/apikey
                </a>
              </li>
            )}
            <li>
              This key stays only in your browser (localStorage) and is excluded from Google Drive
              sync and export/import.
            </li>
            <li>
              Keep the key private and do not share it with anyone.
            </li>
          </ul>
        )}
      </section >

      <section className="card">
        <div className="card__header">
          <h2>Data Controls</h2>
        </div>
        <div className="settings-subsection">
          <h3>Import / Export</h3>
          <p className="hint settings-note">
            Includes your <strong>Inventory</strong>, <strong>History</strong>, and{" "}
            <strong>Goals</strong>. Importing will <strong>completely overwrite</strong> your
            current local data (it does not merge).
          </p>
          <div className="storage-actions">
            <button className="ghost" onClick={() => exportToFile()} type="button">
              Export File
            </button>
            <button className="ghost" onClick={() => fileInputRef.current?.click()} type="button">
              Import File
            </button>
            <button className="ghost" onClick={() => copyToClipboard()} type="button">
              Copy JSON
            </button>
            <button className="ghost" onClick={() => pasteFromClipboard()} type="button">
              Paste JSON
            </button>
          </div>
        </div>
        <div className="settings-subsection">
          <h3>Reset</h3>
          <p className="hint settings-note">
            These actions only modify your browser's local data. They do not affect data stored in
            Google Drive.
          </p>
          <div className="storage-actions">
            <button className="ghost" onClick={() => resetInventory()} type="button">
              Reset Inventory
            </button>
            <button className="ghost" onClick={() => resetHistory()} type="button">
              Reset History
            </button>
            <button className="ghost" onClick={() => resetGoals()} type="button">
              Reset Goals
            </button>
          </div>
        </div>
        <div className="settings-subsection">
          <h3>Google Drive</h3>
          <p className="hint settings-note">
            Google Drive sync uses the app's private storage area and won't touch your regular Drive
            files. You can manage and delete data uploaded by this app at{" "}
            <a
              href="https://drive.google.com/drive/settings"
              target="_blank"
              rel="noreferrer"
            >
              drive.google.com/drive/settings
            </a>{" "}
            under "Manage apps".
          </p>
          <div className="storage-actions">
            {!driveConnected && (
              <button className="ghost" onClick={() => connectDrive()} disabled={driveBusy}>
                Connect Drive
              </button>
            )}
            {driveConnected && (
              <>
                <button className="ghost" onClick={() => disconnectDrive()} disabled={driveBusy}>
                  Disconnect Drive
                </button>
                <button
                  className="ghost"
                  onClick={() => saveToDrive()}
                  disabled={driveBusy}
                  type="button"
                >
                  Save to Drive
                </button>
                <button
                  className="ghost"
                  onClick={() => loadFromDrive()}
                  disabled={driveBusy}
                  type="button"
                >
                  Load from Drive
                </button>
              </>
            )}
          </div>
        </div>
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
              setAppError(err instanceof Error ? err.message : "Import failed.");
            } finally {
              event.target.value = "";
            }
          }}
        />
      </section>
    </>
  );
}
