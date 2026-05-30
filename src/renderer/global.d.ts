import type { MimoAPI } from '../preload/index.js';

declare global {
  interface Window {
    api: MimoAPI;
  }
}
