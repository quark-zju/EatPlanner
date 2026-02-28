import { useRef } from "react";
import { useAtom } from "jotai";
import { useAtomValue } from "jotai";
import {
  appStateAtom,
  driveBusyAtom,
  driveConnectedAtom,
} from "../../state/appAtoms";
import { openAiKeyAtom, sanitizeOpenAiKey } from "../../state/appOpenAi";
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
import { setAppError } from "../../state/appStoreActions";

export default function SettingsTab() {
  const state = useAtomValue(appStateAtom);
  const driveConnected = useAtomValue(driveConnectedAtom);
  const driveBusy = useAtomValue(driveBusyAtom);
  const [openAiKey, setOpenAiKey] = useAtom(openAiKeyAtom);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="card">
      <div className="card__header">
        <h2>Settings</h2>
      </div>

      <h3>Goals</h3>
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

      <h3>Plan Generation</h3>
      <div className="goal-grid">
        <div className="setting-row">
          <label className="macro-label">Maximum Plan Count</label>
          <input
            type="number"
            min={1}
            value={state.planOptionLimit}
            onChange={(event) => setPlanOptionLimit(Number(event.target.value))}
          />
          <span>plans</span>
        </div>
      </div>
      <h3>Data Controls</h3>
      <div className="storage-actions">
        <button className="ghost" onClick={() => exportToFile()} type="button">
          Export File
        </button>
        <button className="ghost" onClick={() => copyToClipboard()} type="button">
          Copy JSON
        </button>
        <button className="ghost" onClick={() => fileInputRef.current?.click()} type="button">
          Import File
        </button>
        <button className="ghost" onClick={() => pasteFromClipboard()} type="button">
          Paste JSON
        </button>
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

      <h3>Google Drive Sync</h3>
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

      <p className="hint settings-note">
        Google Drive sync uses the app's private storage area and won't touch your regular Drive
        files.
      </p>

      <h3>OpenAI Vision</h3>
      <div className="goal-grid">
        <label className="setting-row">
          <span className="macro-label">OpenAI API Key</span>
          <input
            type="password"
            value={openAiKey}
            placeholder="sk-..."
            autoComplete="off"
            onChange={(event) => setOpenAiKey(sanitizeOpenAiKey(event.target.value))}
          />
          <button
            className="ghost"
            type="button"
            onClick={() => setOpenAiKey("")}
            disabled={openAiKey.length === 0}
          >
            Clear
          </button>
        </label>
      </div>
      <p className="hint settings-note">
        This key stays only in your browser (localStorage) and is excluded from Google Drive sync
        and export/import.
      </p>
      <p className="hint settings-note">
        This key is used for photo-based food recognition and is billed by OpenAI. Create a key at
        <a href="https://platform.openai.com/api-keys">https://platform.openai.com/api-keys</a> and
        add credit at
        <a href="https://platform.openai.com/settings/organization/billing/overview">
          https://platform.openai.com/settings/organization/billing/overview
        </a>
        . Keys can expire, so topping up a few dollars is recommended. Keep this key private and do
        not share it with anyone.
      </p>
    </section>
  );
}
