import { useRef } from "react";
import type { ReactNode } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activeTabAtom, errorAtom, noticeAtom } from "../state/appAtoms";
import { clearMessages } from "../state/appStoreActions";
import type { UiTab } from "../state/appState";

type AppShellProps = {
  children: ReactNode;
};

const tabs: { id: UiTab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "inventory", label: "Inventory" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

export default function AppShell({ children }: AppShellProps) {
  const activeTab = useAtomValue(activeTabAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const error = useAtomValue(errorAtom);
  const notice = useAtomValue(noticeAtom);
  const iconRef = useRef<HTMLImageElement>(null);

  const handleIconClick = () => {
    const icon = iconRef.current;
    if (!icon) return;

    icon.animate(
      [
        { transform: "rotate(20deg)" },
        { transform: "rotate(740deg) scale(1.1)", offset: 0.5 },
        { transform: "rotate(20deg)" },
      ],
      {
        duration: 800,
        easing: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      }
    );
  };

  return (
    <div className="app">
      <header className="app__header">
        <img
          ref={iconRef}
          src="icon.svg"
          alt=""
          className="app-icon"
          onClick={handleIconClick}
        />
        <div>
          <h1>Eat Planner</h1>
          <p>Plan meals around the food you already have.</p>
        </div>
      </header>

      <nav className="nav-tabs" aria-label="Main Navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? "is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {(error || notice) && (
        <div className={`global-message ${error ? "error" : "notice"}`}>
          <span>{error ?? notice}</span>
          <button
            type="button"
            className="message-dismiss"
            aria-label="Dismiss message"
            onClick={clearMessages}
          >
            x
          </button>
        </div>
      )}

      <main className="app__grid">{children}</main>

      <footer className="app__footer">
        <a href="privacy.html" target="_blank" rel="noreferrer">
          Privacy
        </a>
        <span>•</span>
        <a href="terms.html" target="_blank" rel="noreferrer">
          Terms
        </a>
        <span>•</span>
        <a
          href="https://github.com/quark-zju/EatPlanner"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
