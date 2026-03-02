# Eat Planner

Plan meals from what you already have.

## How it works

- A planner generates candidate plans using your goals and pantry stock.
- You pick or edit a plan then save it to "history".
- Data is stored locally; optional export/import, or sync to Google Drive.

## Tech Stack

Choices I made:

- React + TypeScript + Vite
- Jotai for state management
- z3-solver for planning

Most coding is done by AI. I was experimenting different AIs.
I use `Agent-Model:` in commit message to track which AI was used.

See [MODEL_STATS.md](MODEL_STATS.md) for contribution stats.

<details>
<summary>Project Structure</summary>

```text
src/
  core/
    types.ts            # Domain types for foods/goals/plan I/O
    solver.ts           # Z3 planner and option generation
    solver.test.ts      # Solver tests
    foodVision.ts       # AI photo-based food nutrition recognition (OpenAI/Gemini)
    visionProvider.ts   # Unified AI vision provider interface
  state/
    appState.ts         # App state model, validation, normalization, date helpers
    appAtoms.ts         # Read/derived atoms + storage-backed app state
    appAiConfig.ts      # AI provider and key storage (localStorage only)
    *Actions.ts         # Store-backed write actions (domain, inventory, draft, planner, data, drive)
    appDraftMath.ts     # Shared draft math: totals, price, remaining goal
    appState.test.ts    # State normalization tests
    appAtoms.test.ts    # State/action workflow tests (non-React)
  storage/
    exportImport.ts     # Versioned export/import envelope and parsing
    googleDrive.ts      # Browser OAuth + Drive appDataFolder integration
  components/
    AppShell.tsx        # Header/nav shell + global messages
    tabs/
      TodayTab.tsx      # Planner + draft editor
      InventoryTab.tsx  # Pantry/inventory management table
      HistoryTab.tsx    # 30-day history window UI
      SettingsTab.tsx   # Goals + data/sync controls
  App.tsx               # Root composition by active tab
  App.css               # Shared styles
  main.tsx              # React entrypoint

public/
  privacy.html          # Privacy policy page for users/OAuth review
  terms.html            # Terms of service page
  z3-built.js|wasm      # Browser Z3 runtime assets
```

</details>
