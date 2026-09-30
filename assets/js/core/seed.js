/**
 * seed.js — Copies the mock JSON data in /data into localStorage on first run
 * (or whenever DATA_VERSION changes, or stored data is missing/corrupted).
 * See ARCHITECTURE.md §4.3.
 */

import {
  DATA_VERSION,
  STORAGE_KEYS,
  SEED_SOURCES,
  EMPTY_COLLECTION_KEYS,
} from './config.js';
import { getLocal, setLocal, clearLocalAppData } from './storage.js';
import { toRoot } from './utils.js';

/** Every collection key must hold an array for the stored data to be usable. */
function isStoredDataValid() {
  if (getLocal(STORAGE_KEYS.DATA_VERSION) !== DATA_VERSION) return false;
  const collectionKeys = [...SEED_SOURCES.map((source) => source.key), ...EMPTY_COLLECTION_KEYS];
  return collectionKeys.every((key) => Array.isArray(getLocal(key)));
}

const SERVER_HINT = 'Could not load demo data. Open FreshHire through a local static server '
  + '(e.g. VS Code Live Server) and reload the page.';

/** Fetch one seed file and make sure it contains an array. */
async function fetchSeedFile(path) {
  let response;
  try {
    response = await fetch(toRoot(path), { cache: 'no-store' });
  } catch {
    throw new Error(SERVER_HINT); // network-level failure: no server, or blocked request
  }
  if (!response.ok) {
    throw new Error(`Could not load ${path} (HTTP ${response.status})`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`${path} must contain a JSON array`);
  }
  return data;
}

/**
 * Make sure demo data exists in localStorage. Call (and await) this first in every page script.
 * @param {{ force?: boolean }} [options] force = reload the seed files even if data is valid
 *   (admin "Reset demo data", BR-20); the files are fetched before anything is cleared
 * @returns {Promise<{ seeded: boolean }>} seeded = true when data was (re)loaded now
 * @throws {Error} with a user-friendly message if the seed files can't be loaded
 */
export async function ensureSeeded({ force = false } = {}) {
  if (!force && isStoredDataValid()) return { seeded: false };

  // Load every file first so a failure never leaves storage half-written.
  const collections = await Promise.all(SEED_SOURCES.map((source) => fetchSeedFile(source.path)));

  clearLocalAppData();
  const writes = [
    ...SEED_SOURCES.map((source, index) => setLocal(source.key, collections[index])),
    ...EMPTY_COLLECTION_KEYS.map((key) => setLocal(key, [])),
    setLocal(STORAGE_KEYS.DATA_VERSION, DATA_VERSION),
  ];

  const failed = writes.find((result) => !result.ok);
  if (failed) throw new Error(failed.error);

  return { seeded: true };
}
