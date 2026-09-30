/**
 * storage.js — The ONLY module that talks to localStorage / sessionStorage.
 * Values are stored as JSON. Every other module goes through these helpers.
 */

import { STORAGE_PREFIX, STORAGE_KEYS } from './config.js';

/**
 * Read and parse a JSON value.
 * @param {Storage} store
 * @param {string} key
 * @param {*} fallback returned when the key is missing or unreadable
 */
function readJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.error(`storage: could not read "${key}"`, error);
    return fallback;
  }
}

/**
 * Serialise and write a value.
 * @returns {{ ok: boolean, error?: string }}
 */
function writeJson(store, key, value) {
  try {
    store.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    const isQuota = error instanceof DOMException && error.name === 'QuotaExceededError';
    console.error(`storage: could not write "${key}"`, error);
    return {
      ok: false,
      error: isQuota
        ? 'Browser storage is full. Remove large files (e.g. resumes) and try again.'
        : 'Could not save data in this browser.',
    };
  }
}

/* ---------- localStorage (persistent) ---------- */

/** @returns {*} parsed value or `fallback` */
export function getLocal(key, fallback = null) {
  return readJson(window.localStorage, key, fallback);
}

/** @returns {{ ok: boolean, error?: string }} */
export function setLocal(key, value) {
  return writeJson(window.localStorage, key, value);
}

export function removeLocal(key) {
  window.localStorage.removeItem(key);
}

/** Remove every FreshHire key (fh_*) from localStorage; other sites' data is untouched. */
export function clearLocalAppData() {
  const appKeys = Object.keys(window.localStorage).filter((key) => key.startsWith(STORAGE_PREFIX));
  appKeys.forEach((key) => window.localStorage.removeItem(key));
}

/* ---------- sessionStorage (per tab) ---------- */

/** @returns {*} parsed value or `fallback` */
export function getSession(key, fallback = null) {
  return readJson(window.sessionStorage, key, fallback);
}

/** @returns {{ ok: boolean, error?: string }} */
export function setSession(key, value) {
  return writeJson(window.sessionStorage, key, value);
}

export function removeSession(key) {
  window.sessionStorage.removeItem(key);
}

/* ---------- One-time "flash" message for the next page (fh_flash) ---------- */

/**
 * Queue a message to show once on the next page load (e.g. after a redirect).
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 */
export function setFlash(message, type = 'info') {
  return setSession(STORAGE_KEYS.FLASH, { message, type });
}

/** Read and remove the queued flash message. @returns {{ message: string, type: string }|null} */
export function consumeFlash() {
  const flash = getSession(STORAGE_KEYS.FLASH);
  removeSession(STORAGE_KEYS.FLASH);
  return flash && typeof flash.message === 'string' ? flash : null;
}
