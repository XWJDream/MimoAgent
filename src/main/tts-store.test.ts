import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.useFakeTimers();

const { setAudio, getAudio, deleteAudio, getStoreSize, ttsAudioStore } = await import('./tts-store.js');

describe('tts-store', () => {
  beforeEach(() => {
    ttsAudioStore.clear();
  });

  it('should save audio buffer with a given ID', () => {
    const buffer = Buffer.from('audio-data');
    setAudio('id-1', buffer);
    expect(getStoreSize()).toBe(1);
    expect(ttsAudioStore.has('id-1')).toBe(true);
  });

  it('should retrieve audio buffer by ID', () => {
    const buffer = Buffer.from('hello-audio');
    setAudio('id-2', buffer);
    const result = getAudio('id-2');
    expect(result).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(Buffer.compare(result!, buffer)).toBe(0);
  });

  it('should return undefined for non-existent ID', () => {
    expect(getAudio('missing-id')).toBeUndefined();
  });

  it('should return undefined for expired audio', () => {
    const buffer = Buffer.from('expiring');
    setAudio('id-3', buffer);

    // Advance time past TTL (30 minutes)
    vi.advanceTimersByTime(31 * 60 * 1000);

    expect(getAudio('id-3')).toBeUndefined();
  });

  it('should store audio data correctly with binary content', () => {
    const data = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF header
    setAudio('wav-id', data);
    const result = getAudio('wav-id');
    expect(result).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result!.length).toBe(4);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result![0]).toBe(0x52);
  });

  it('should delete audio by ID', () => {
    setAudio('del-id', Buffer.from('data'));
    expect(deleteAudio('del-id')).toBe(true);
    expect(getAudio('del-id')).toBeUndefined();
  });

  it('should return false when deleting non-existent ID', () => {
    expect(deleteAudio('nope')).toBe(false);
  });

  it('should track store size accurately', () => {
    expect(getStoreSize()).toBe(0);
    setAudio('a', Buffer.from('1'));
    expect(getStoreSize()).toBe(1);
    setAudio('b', Buffer.from('2'));
    expect(getStoreSize()).toBe(2);
    deleteAudio('a');
    expect(getStoreSize()).toBe(1);
  });

  it('should evict oldest entries when store reaches capacity', () => {
    // Fill store to MAX_ENTRIES (50)
    for (let i = 0; i < 50; i++) {
      setAudio(`id-${i}`, Buffer.from(`data-${i}`));
    }
    expect(getStoreSize()).toBe(50);

    // Adding one more should trigger eviction of oldest 20% (10 entries)
    setAudio('id-50', Buffer.from('data-50'));
    expect(getStoreSize()).toBeLessThanOrEqual(41);
    // New entry should exist
    expect(ttsAudioStore.has('id-50')).toBe(true);
  });
});
