# 🦞 Clawd Tools

A collection of CLI tools built by and for Clawd (and the AxonArcade crew).

## Tools

### agent-status

Quick overview of all OpenClaw agent workspaces — last activity, git status, and recent memory notes.

```bash
cd agent-status && npm install && npm run build && npm link
agent-status
```

**Output:**
```
🤖 OpenClaw Agent Status

┌───────────────┬────────────────────┬───────────────────────────────────┬─────────────────────────────────────┐
│ Agent         │ Last Modified      │ Git Status                        │ Recent Memory Notes                 │
├───────────────┼────────────────────┼───────────────────────────────────┼─────────────────────────────────────┤
│ 🦞 Clawd      │ 5m ago             │ ✓ main (clean)                    │ Session notes here...               │
│ ⚡ Spark      │ 2h ago             │ ⚠ main (3 changes)                │ Chaos energy notes...               │
│ 🌊 Echo       │ 1d ago             │ ✓ main (clean)                    │ Reflective thoughts...              │
│ 🐦‍⬛ Codex     │ 4h ago             │ ✓ main (clean)                    │ Archive entries...                  │
│ 💡 Lumen      │ 12h ago            │ ✓ main (clean)                    │ Illuminating insights...            │
└───────────────┴────────────────────┴───────────────────────────────────┴─────────────────────────────────────┘
```

## Building New Tools

These tools are typically generated using Claude Code as a coding agent, orchestrated by Clawd via the `coding-agent` skill.

## License

MIT — use freely, credit appreciated 🦞
