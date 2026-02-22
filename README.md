# Eat Planner

Plan meals from what you already have.

## How it works

- A planner generates candidate plans using your goals and pantry stock.
- You pick or edit a plan then save it to "history".
- Data is stored locally; optional export/import, or sync to Google Drive.

## Tech Stack

- React + TypeScript + Vite
- Jotai + Immutable.js for state management
- z3-solver for planning

<details>
<summary>Project Structure</summary>

```text
src/
  core/
    types.ts            # Domain types for foods/goals/plan I/O
    solver.ts           # Z3 planner and option generation
    solver.test.ts      # Solver tests
  state/
    appState.ts         # App state model, validation, normalization, date helpers
    appAtoms.ts         # Jotai atoms (UI, planner, draft, history, settings workflows)
    appState.test.ts    # State normalization tests
    appAtoms.test.ts    # Atom workflow tests (non-React)
  storage/
    exportImport.ts     # Versioned export/import envelope and parsing
    googleDrive.ts      # Browser OAuth + Drive appDataFolder integration
  components/
    AppShell.tsx        # Header/nav shell + global messages
    tabs/
      TodayTab.tsx      # Planner + draft + pantry editor
      HistoryTab.tsx    # 30-day history window UI
      SettingsTab.tsx   # Goals + data/sync controls
  App.tsx               # Root composition by active tab
  App.css               # Shared styles
  main.tsx              # React entrypoint

public/
  privacy.html          # Privacy policy page for users/OAuth review
  z3-built.js|wasm      # Browser Z3 runtime assets
  coi-serviceworker.min.js  # COOP/COEP helper for static hosting
```

</details>