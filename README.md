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
I use `Agent-Model:` in commit message to document which AI was used.

<!-- [[[cog
import re
import subprocess
from collections import defaultdict

import cog


def extract_model_name(message: str) -> str:
    match = re.search(r"^Agent-Model:\s*(\S+)", message, re.MULTILINE)
    if not match:
        return "manual"
    return match.group(1).rstrip("/").split("/")[-1]


def parse_commit_loc(line: str) -> int:
    parts = line.split("\t", 2)
    if len(parts) < 3 or not parts[0].isdigit() or not parts[1].isdigit():
        return 0
    return int(parts[0]) + int(parts[1])


raw_log = subprocess.check_output(
    ["git", "log", "--numstat", "--format=%x1e%B"],
    text=True,
    encoding="utf-8",
    errors="replace",
)

stats = defaultdict(lambda: {"commits": 0, "loc": 0})

for chunk in raw_log.split("\x1e"):
    chunk = chunk.strip()
    if not chunk:
        continue

    message_lines = []
    loc = 0
    for line in chunk.splitlines():
        file_loc = parse_commit_loc(line)
        if file_loc:
            loc += file_loc
        else:
            message_lines.append(line)

    model = extract_model_name("\n".join(message_lines))
    stats[model]["commits"] += 1
    stats[model]["loc"] += loc

rows = sorted(stats.items(), key=lambda item: (-item[1]["commits"], item[0].lower()))

total_commits = sum(d["commits"] for _, d in rows)
total_loc = sum(d["loc"] for _, d in rows)

cog.outl("| Model | Commit | LOC |")
cog.outl("| --- | ---: | ---: |")
for model, data in rows:
    safe_model = model.replace("|", "\\|")
    c = data["commits"]
    l = data["loc"]
    cp = f"({100*c//total_commits}%)" if total_commits else "(0%)"
    lp = f"({100*l//total_loc}%)" if total_loc else "(0%)"
    cog.outl(f"| {safe_model} | {c} {cp} | {l} {lp} |")
]]] -->
| Model | Commit | LOC |
| --- | ---: | ---: |
| gpt-5.3-codex | 92 (51%) | 22034 (68%) |
| gpt-5.2-codex | 47 (26%) | 8795 (27%) |
| manual | 18 (10%) | 462 (1%) |
| claude-sonnet-4.6 | 10 (5%) | 236 (0%) |
| gemini-3-flash-preview | 6 (3%) | 511 (1%) |
| MiniMax-M2.5 | 6 (3%) | 114 (0%) |
<!-- [[[end]]] -->

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
  coi-serviceworker.min.js  # COOP/COEP helper for static hosting
```

</details>
