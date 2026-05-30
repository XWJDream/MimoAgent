# Engine

The `engine` folder is an independent TypeScript package for the Mimo coding agent. The desktop app dynamically imports `engine/dist/core/agent.js`, so the engine must be built before desktop runtime or packaging.

## CLI Usage

```powershell
npm --prefix engine run dev -- "Explain this project"
npm --prefix engine run build
npm --prefix engine run start -- "Fix the failing tests"
```

Useful CLI options are defined in `engine/src/index.ts`, including model, API base, API key, sandbox, and max turns.

## Built-In Tools

The engine registers built-in tools from `engine/src/tools/builtin/index.ts`:

| Tool area | Purpose |
| --- | --- |
| `read_file`, `write_file`, `edit_file` | Read and modify files. |
| `grep`, `glob` | Search text and discover files. |
| `shell` | Run shell commands. |
| `task` | Delegate work to sub-agents when enabled. |

Tool execution requires a `ToolContext` with a working directory and file cache. The desktop integration initializes that context during `Agent.initialize()`.

## Permission Modes

| Mode | Behavior |
| --- | --- |
| `suggest` | Ask before operations when an interactive prompt is available. |
| `auto-edit` | Allow read/write operations and stay more cautious around execution. |
| `full-auto` | Allow most operations, while destructive actions still require confirmation. |

In non-interactive desktop runs, permission prompts cannot block on the terminal. Treat `full-auto` and shell-capable workflows with care.

## Memory And Usage

Project memory is stored under `.mimo-agent/memory.md`. Usage tracking is handled by `engine/src/context/usage-tracker.ts`.
