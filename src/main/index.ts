import { app, BrowserWindow, protocol, session } from 'electron';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createMainWindow, loadMainWindow } from './window.js';
import { registerIpcHandlers } from './ipc.js';
import { ttsAudioStore } from './tts-store.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
config({ path: join(__dirname, '..', '..', '.env') });

// Register tts-audio as privileged scheme BEFORE app is ready
protocol.registerSchemesAsPrivileged([{
  scheme: 'tts-audio',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true },
}]);

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  // Register protocol handler for TTS audio playback
  // Use tts-audio scheme and serve WAV data as blob response
  protocol.handle('tts-audio', (request) => {
    const id = request.url.replace('tts-audio://', '').replace(/\/$/, '');
    const buf = ttsAudioStore.get(id);
    console.log('[tts-audio] id:', id, 'found:', !!buf, 'size:', buf?.length);
    if (!buf) return new Response('Not found', { status: 404 });
    // Return as Blob with correct MIME type
    const blob = new Blob([new Uint8Array(buf)], { type: 'audio/wav' });
    return new Response(blob);
  });

  mainWindow = createMainWindow();
  registerIpcHandlers(mainWindow);
  loadMainWindow(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      registerIpcHandlers(mainWindow);
      loadMainWindow(mainWindow);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
