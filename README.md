# Eat Planner

A browser-first food planning app that helps users build a daily eating plan from foods they already have, then log what they actually ate.

## Purpose

Eat Planner focuses on three workflows:

1. Plan today’s intake against macro goals using available pantry foods.
2. Let users adjust generated plans to reflect real consumption.
3. Keep an immutable daily history snapshot so past records stay accurate even if food definitions change later.

## Core Concepts

- `Goal`: Macro target ranges (carbs/fat/protein).
- `Food`: Name, unit, nutrition per unit, optional price.
- `Pantry`: Current stock per food (`number` or `"inf"`).
- `Draft`: Editable plan for a target day.
- `History`: Daily snapshot records (`one record per date`, replace on resubmit).

## App Navigation

- `Today`
  - Generate planner options.
  - Select an option into Draft Editor.
  - Edit quantities (non-negative decimals).
  - Add/remove foods in draft and submit to history.
- `History`
  - Rolling 30-day view.
  - Previous/Next/Jump controls for 30-day pagination.
  - Expanded detail includes item snapshots and goal snapshot.
- `Settings`
  - Goal editing.
  - Export/import controls.
  - Google Drive sync controls.
  - Privacy policy link.

## How It Works

### Planner

- Uses a Z3-based solver (`z3-solver`) to generate candidate plans based on:
  - Goal ranges
  - Pantry stock
  - Avoid/prefer constraints
- Returns top options sorted by known price lower bound.

### Draft + History Snapshot

- Selecting an option clones food snapshots into draft (`name/unit/nutrition/price-per-unit`).
- Submitting draft creates a `HistoryDayRecord` keyed by local date (`YYYY-MM-DD`).
- Resubmitting the same date replaces that date’s record.

### Persistence

- Main app state is persisted in browser localStorage.
- Export/import uses a versioned envelope (`schema`, `version`, `payload`).
- Optional Google Drive sync stores export JSON in `appDataFolder`.

## Tech Stack

- React + TypeScript + Vite
- Jotai for state management
- Immutable.js as backing representation for persisted state atom
- Vitest for tests
- z3-solver for optimization/planning

## Developer Setup

### Prerequisites

- Node.js 18+ recommended

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

### Test

```bash
npm test
```

### Build

```bash
npm run build
```

## Project Structure

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

## Data and Privacy Notes

- User data is local by default.
- Google Drive sync is optional and scoped to app data folder.
- Source is auditable; see `public/privacy.html` and repository history.

## Known Constraints

- Browser environment must support `SharedArrayBuffer` for Z3 execution.
- Static hosting needs COOP/COEP handling; this project includes `coi-serviceworker` support.
