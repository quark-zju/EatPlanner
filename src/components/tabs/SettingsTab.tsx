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
import { AllLangs, changeLang, getLang, useTranslation } from "../../i18n";

export default function SettingsTab() {
  const t = useTranslation();
  const state = useAtomValue(appStateAtom);
  const driveConnected = useAtomValue(driveConnectedAtom);
  const driveBusy = useAtomValue(driveBusyAtom);
  const [aiProvider, setAiProvider] = useAtom(aiProviderAtom);
  const [openAiKey, setOpenAiKey] = useAtom(openAiKeyAtom);
  const [geminiKey, setGeminiKey] = useAtom(geminiKeyAtom);
  const currentLang = getLang();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <section className="card">
        <div className="card__header">
          <h2>{t.settings.Language}</h2>
        </div>
        <div className="goal-grid">
          <div className="setting-row">
            <label className="macro-label">{t.settings.Language}</label>
            <div className="setting-control">
              <select
                value={currentLang}
                onChange={(e) => changeLang(e.target.value as "en" | "cn")}
              >
                {AllLangs.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang === "en" ? "English" : "简体中文"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>{t.settings.Goals}</h2>
        </div>
        <div className="goal-grid">
          {(["carbs", "fat", "protein"] as const).map((macro) => (
            <div className="goal-row" key={macro}>
              <label className="macro-label">{t.macros[macro]}</label>
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
          <h2>{t.settings.PlanGeneration}</h2>
        </div>
        <div className="goal-grid">
          <div className="setting-row">
            <label className="macro-label">{t.settings.MaximumPlanCount}</label>
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
          <h2>{t.settings.VisionRecognition}</h2>
        </div>
        <p className="hint">
          {t.settings.VisionHint}
        </p>
        <div className="hint" style={{ marginTop: 10 }}>
          {t.settings.ModelTips}:
          <ul className="settings-note" style={{ marginTop: 5 }}>
            <li>Google Gemini API has <a href='https://ai.google.dev/gemini-api/docs/pricing' target="_blank" rel="noreferrer">free and paid tiers</a>. Free tier usage can be used for training.</li>
            <li>OpenAI GPT API is paid, although cheap. Usage is <a href='https://openai.com/api-data-privacy' target="_blank" rel="noreferrer">not used for training</a>.</li>
          </ul>
        </div>
        <div className="goal-grid" style={{ marginTop: 10 }} >
          <div className="setting-row">
            <label className="macro-label">{t.settings.Provider}</label>
            <div className="setting-control">
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as any)}
              >
                <option value="none">{t.settings.Disabled}</option>
                <option value="gemini">{t.settings.GoogleGemini}</option>
                <option value="openai">{t.settings.OpenAIGPT}</option>
              </select>
            </div>
          </div>

          {aiProvider === "openai" && (
            <form className="api-key-row" onSubmit={(e) => e.preventDefault()}>
              {/* Invisible username field to help browser password managers */}
              <input
                type="text"
                name="username"
                value="OpenAI API Key"
                readOnly
                autoComplete="username"
                style={{ display: "none" }}
              />
              <label className="macro-label" htmlFor="openai-api-key">
                {t.settings.OpenAIKey}
              </label>
              <div className="api-key-control">
                <input
                  id="openai-api-key"
                  name="password"
                  className="api-key-input"
                  type="password"
                  value={openAiKey}
                  placeholder="sk-..."
                  autoComplete="current-password"
                  onChange={(event) => setOpenAiKey(event.target.value)}
                />
                <button
                  className="ghost"
                  type="button"
                  onClick={() => setOpenAiKey("")}
                  disabled={openAiKey.length === 0}
                >
                  {t.settings.Clear}
                </button>
              </div>
            </form>
          )}

          {aiProvider === "gemini" && (
            <form className="api-key-row" onSubmit={(e) => e.preventDefault()}>
              {/* Invisible username field to help browser password managers */}
              <input
                type="text"
                name="username"
                value="Gemini API Key"
                readOnly
                autoComplete="username"
                style={{ display: "none" }}
              />
              <label className="macro-label" htmlFor="gemini-api-key">
                {t.settings.GeminiKey}
              </label>
              <div className="api-key-control">
                <input
                  id="gemini-api-key"
                  name="password"
                  className="api-key-input"
                  type="password"
                  value={geminiKey}
                  placeholder="AIza..."
                  autoComplete="current-password"
                  onChange={(event) => setGeminiKey(event.target.value)}
                />
                <button
                  className="ghost"
                  type="button"
                  onClick={() => setGeminiKey("")}
                  disabled={geminiKey.length === 0}
                >
                  {t.settings.Clear}
                </button>
              </div>
            </form>
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
          <h2>{t.settings.DataControls}</h2>
        </div>
        <div className="settings-subsection">
          <h3>{t.settings.ImportExport}</h3>
          <p className="hint settings-note">
            {t.settings.ImportExportHint}
          </p>
          <div className="storage-actions">
            <button className="ghost" onClick={() => exportToFile()} type="button">
              {t.settings.ExportFile}
            </button>
            <button className="ghost" onClick={() => fileInputRef.current?.click()} type="button">
              {t.settings.ImportFile}
            </button>
            <button className="ghost" onClick={() => copyToClipboard()} type="button">
              {t.settings.CopyJSON}
            </button>
            <button className="ghost" onClick={() => pasteFromClipboard()} type="button">
              {t.settings.PasteJSON}
            </button>
          </div>
        </div>
        <div className="settings-subsection">
          <h3>{t.settings.Reset}</h3>
          <p className="hint settings-note">
            {t.settings.ResetHint}
          </p>
          <div className="storage-actions">
            <button
              className="ghost"
              onClick={() => {
                if (window.confirm(t.settings.ResetInventoryConfirm)) {
                  resetInventory();
                }
              }}
              type="button"
            >
              {t.settings.ResetInventory}
            </button>
            <button
              className="ghost"
              onClick={() => {
                if (window.confirm(t.settings.ResetHistoryConfirm)) {
                  resetHistory();
                }
              }}
              type="button"
            >
              {t.settings.ResetHistory}
            </button>
            <button
              className="ghost"
              onClick={() => {
                if (window.confirm(t.settings.ResetGoalsConfirm)) {
                  resetGoals();
                }
              }}
              type="button"
            >
              {t.settings.ResetGoals}
            </button>
          </div>
        </div>
        <div className="settings-subsection">
          <h3>{t.settings.GoogleDrive}</h3>
          <p className="hint settings-note">
            {t.settings.DriveHint}
          </p>
          <div className="storage-actions">
            {!driveConnected && (
              <button className="ghost" onClick={() => connectDrive()} disabled={driveBusy}>
                {t.settings.ConnectDrive}
              </button>
            )}
            {driveConnected && (
              <>
                <button className="ghost" onClick={() => disconnectDrive()} disabled={driveBusy}>
                  {t.settings.DisconnectDrive}
                </button>
                <button
                  className="ghost"
                  onClick={() => saveToDrive()}
                  disabled={driveBusy}
                  type="button"
                >
                  {t.settings.SaveToDrive}
                </button>
                <button
                  className="ghost"
                  onClick={() => loadFromDrive()}
                  disabled={driveBusy}
                  type="button"
                >
                  {t.settings.LoadFromDrive}
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
