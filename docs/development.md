# Development

## Requirements

- Node.js 18 or newer
- npm
- Docker, only if sandbox mode is needed

## Desktop Development

```powershell
npm install
npm --prefix engine install
npm run start:dev
```

The development script starts Vite on port `5173`, sets `VITE_DEV_SERVER_URL`, and launches Electron.

## Renderer-Only Development

```powershell
npm run dev
```

This only starts the Vite renderer. It is useful for visual work but does not exercise Electron IPC or the agent service.

## IPC Flow

The renderer never imports Electron directly. It calls `window.api`, which is exposed by `src/preload/index.ts`. The main process handles those calls in `src/main/ipc.ts` and forwards agent work to `src/main/agent-service.ts`.

When adding a new desktop capability, update:

- `src/shared/ipc-channels.ts`
- `src/shared/types.ts` when a shared type is needed
- `src/preload/index.ts`
- `src/main/ipc.ts`
- the renderer store/component that consumes it
