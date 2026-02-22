import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  connectDriveAtom,
  copyToClipboardAtom,
  disconnectDriveAtom,
  driveBusyAtom,
  driveConnectedAtom,
  exportToFileAtom,
  importFromFileAtom,
  pasteFromClipboardAtom,
  saveToDriveAtom,
  loadFromDriveAtom,
  setErrorAtom,
} from "../../state/appAtoms";

export default function SettingsTab() {
  const driveConnected = useAtomValue(driveConnectedAtom);
  const driveBusy = useAtomValue(driveBusyAtom);

  const exportToFile = useSetAtom(exportToFileAtom);
  const copyToClipboard = useSetAtom(copyToClipboardAtom);
  const pasteFromClipboard = useSetAtom(pasteFromClipboardAtom);
  const importFromFile = useSetAtom(importFromFileAtom);
  const connectDrive = useSetAtom(connectDriveAtom);
  const disconnectDrive = useSetAtom(disconnectDriveAtom);
  const saveToDrive = useSetAtom(saveToDriveAtom);
  const loadFromDrive = useSetAtom(loadFromDriveAtom);
  const setError = useSetAtom(setErrorAtom);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="card">
      <div className="card__header">
        <h2>Settings</h2>
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
            setError(err instanceof Error ? err.message : "Import failed.");
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
          <button className="ghost" onClick={() => disconnectDrive()} disabled={driveBusy}>
            Disconnect Drive
          </button>
        )}
        <button className="ghost" onClick={() => saveToDrive()} disabled={driveBusy} type="button">
          Save to Drive
        </button>
        <button className="ghost" onClick={() => loadFromDrive()} disabled={driveBusy} type="button">
          Load from Drive
        </button>
      </div>

      <p className="hint">Export uses a versioned schema. Google Drive sync writes to app data.</p>
      <p className="hint">
        Privacy Policy:{" "}
        <a href="/privacy.html" target="_blank" rel="noreferrer">
          /privacy.html
        </a>
      </p>
    </section>
  );
}
