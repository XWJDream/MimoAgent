// In-memory store for TTS audio buffers, keyed by ID
// With TTL mechanism to prevent memory leaks

interface AudioEntry {
  buffer: Buffer;
  timestamp: number;
}

const store = new Map<string, AudioEntry>();

// TTL: 30 minutes (in milliseconds)
const TTL = 30 * 60 * 1000;

// Cleanup interval: every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Maximum number of entries
const MAX_ENTRIES = 50;

export function setAudio(id: string, buffer: Buffer): void {
  // If store is full, remove oldest entries
  if (store.size >= MAX_ENTRIES) {
    const entries = Array.from(store.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    // Remove oldest 20% of entries
    const removeCount = Math.ceil(MAX_ENTRIES * 0.2);
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      store.delete(entries[i][0]);
    }
  }

  store.set(id, { buffer, timestamp: Date.now() });
}

export function getAudio(id: string): Buffer | undefined {
  const entry = store.get(id);
  if (!entry) return undefined;

  // Check if expired
  if (Date.now() - entry.timestamp > TTL) {
    store.delete(id);
    return undefined;
  }

  return entry.buffer;
}

export function deleteAudio(id: string): boolean {
  return store.delete(id);
}

export function getStoreSize(): number {
  return store.size;
}

// Cleanup expired entries periodically
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (now - entry.timestamp > TTL) {
      store.delete(id);
    }
  }
}, CLEANUP_INTERVAL);

// Prevent timer from keeping process alive
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

// Legacy export for backward compatibility
export const ttsAudioStore = {
  get: (id: string) => getAudio(id),
  set: (id: string, buffer: Buffer) => setAudio(id, buffer),
  delete: (id: string) => deleteAudio(id),
  has: (id: string) => store.has(id),
  get size() { return store.size; },
  clear: () => store.clear(),
};
