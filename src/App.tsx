import { useAtomValue } from "jotai";
import "./App.css";
import AppShell from "./components/AppShell";
import HistoryTab from "./components/tabs/HistoryTab";
import SettingsTab from "./components/tabs/SettingsTab";
import TodayTab from "./components/tabs/TodayTab";
import { activeTabAtom } from "./state/appAtoms";

export default function App() {
  const activeTab = useAtomValue(activeTabAtom);

  return (
    <AppShell>
      {activeTab === "today" && <TodayTab />}
      {activeTab === "history" && <HistoryTab />}
      {activeTab === "settings" && <SettingsTab />}
    </AppShell>
  );
}
