# Model Stats

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


last_commit_date = subprocess.check_output(
    ["git", "log", "-1", "--format=%ci"],
    text=True,
).strip().split()[0]

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
        parts = line.split("\t", 2)
        if len(parts) >= 3:
            filepath = parts[2]
            if filepath.startswith("public/z3-built.") or filepath == "package-lock.json":
                continue
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

cog.outl(f"AI models sorted by contribution (Last updated: {last_commit_date}):")
cog.outl("")
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
AI models sorted by contribution (Last updated: 2026-03-02):

| Model | Commit | LOC |
| --- | ---: | ---: |
| gpt-5.3-codex | 96 (47%) | 12005 (75%) |
| gpt-5.2-codex | 47 (23%) | 1847 (11%) |
| manual | 23 (11%) | 843 (5%) |
| MiniMax-M2.5 | 20 (9%) | 463 (2%) |
| claude-sonnet-4.6 | 10 (4%) | 229 (1%) |
| gemini-3-flash-preview | 6 (2%) | 511 (3%) |
<!-- [[[end]]] -->
