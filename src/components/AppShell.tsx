import { useRef } from "react";
import type { ReactNode } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activeTabAtom, errorAtom, noticeAtom } from "../state/appAtoms";
import { clearMessages } from "../state/appStoreActions";
import type { UiTab } from "../state/appState";
import { useTranslation } from "../i18n";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const t = useTranslation();
  const activeTab = useAtomValue(activeTabAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const error = useAtomValue(errorAtom);
  const notice = useAtomValue(noticeAtom);
  const iconRef = useRef<HTMLImageElement>(null);

  const tabs: { id: UiTab; label: string }[] = [
    { id: "today", label: t.tabs.today },
    { id: "inventory", label: t.tabs.inventory },
    { id: "history", label: t.tabs.history },
    { id: "settings", label: t.tabs.settings },
  ];

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

  const openLegalPage = (path: "privacy.html" | "terms.html") => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari-style standalone hint (also present on some iOS PWAs).
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

    if (isStandalone) {
      window.location.assign(path);
      return;
    }

    window.open(path, "_blank", "noopener,noreferrer");
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
          <h1>{t.app.Title}</h1>
          <p>{t.app.Subtitle}</p>
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
        <button type="button" className="link-button" onClick={() => openLegalPage("privacy.html")}>
          {t.app.Privacy}
        </button>
        <span>•</span>
        <button type="button" className="link-button" onClick={() => openLegalPage("terms.html")}>
          {t.app.Terms}
        </button>
        <span>•</span>
        <a
          href="https://github.com/quark-zju/EatPlanner"
          target="_blank"
          rel="noreferrer"
        >
          {t.app.GitHub}
        </a>
      </footer>
    </div>
  );
}
