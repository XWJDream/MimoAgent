# Packaging

Build installers with:

```powershell
npm run electron:build
```

This runs the root `build` script first, which compiles:

1. `engine/dist`
2. Electron main and preload TypeScript
3. Vite renderer output

`electron-builder.json` includes both `dist/**/*` and `engine/dist/**/*`, because `AgentService` imports `engine/dist/core/agent.js` at runtime.

## Outputs

| Platform | Target |
| --- | --- |
| Windows | NSIS installer |
| macOS | DMG |
| Linux | AppImage |

Icons are expected in `resources/icon.ico`, `resources/icon.icns`, and `resources/icon.png`.

## Release Checklist

- `npm install`
- `npm --prefix engine install`
- `npm run build`
- Confirm `.env` is not committed
- Confirm `engine/dist/core/agent.js` exists
- Run `npm run electron:build`
