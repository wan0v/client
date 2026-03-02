/**
 * Backs localStorage with a JSON file in Electron's userData directory.
 *
 * Call `initGlobalStorage()` once **before** React renders. It will:
 *   1. Load the file store from the main process via IPC.
 *   2. On first launch, migrate all existing localStorage entries into the
 *      file store (skipping per-user keys already handled by userStore).
 *   3. Restore every file-store entry back into localStorage so existing
 *      consumer code works unchanged.
 *   4. Patch `localStorage.setItem` / `localStorage.removeItem` so future
 *      writes are automatically synced to the file store.
 *
 * On the web (non-Electron), `initGlobalStorage()` is a no-op.
 */

import { getElectronAPI, isElectron } from "./electron";

const MIGRATED_KEY = "_migrated";

export async function initGlobalStorage(): Promise<void> {
  if (!isElectron()) return;

  const api = getElectronAPI();
  if (!api) return;

  const store = await api.loadGlobalStore();

  // ── Migration: first launch after upgrade ──────────────────────
  if (!store[MIGRATED_KEY]) {
    console.log("[GlobalStorage] Running one-time localStorage → file migration");
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("user:")) continue;
      const value = localStorage.getItem(key);
      if (value !== null) {
        store[key] = value;
        count++;
      }
    }
    store[MIGRATED_KEY] = true;
    api.saveGlobalStore(store as Record<string, unknown>);
    console.log(`[GlobalStorage] Migrated ${count} keys to file store`);
  }

  // ── Restore: file store → localStorage ─────────────────────────
  const origSetItem = localStorage.setItem.bind(localStorage);
  let restored = 0;
  for (const [key, value] of Object.entries(store)) {
    if (key === MIGRATED_KEY) continue;
    if (typeof value === "string") {
      origSetItem(key, value);
      restored++;
    }
  }
  console.log(`[GlobalStorage] Restored ${restored} keys into localStorage`);

  // ── Patch: auto-sync future writes to file store ───────────────
  const origRemoveItem = localStorage.removeItem.bind(localStorage);

  localStorage.setItem = (key: string, value: string) => {
    origSetItem(key, value);
    api.setGlobalData(key, value);
  };

  localStorage.removeItem = (key: string) => {
    origRemoveItem(key);
    api.deleteGlobalData(key);
  };
}
