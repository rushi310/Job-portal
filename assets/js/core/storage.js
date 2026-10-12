/**
 * storage.js — The ONLY module that talks to the browser's sessionStorage.
 * Values are stored as JSON. Every other module goes through these helpers.
 *
 * Business data (users, jobs, applications, notifications) lives in the database behind the API.
 * The browser keeps only per-tab conveniences: the login session (token), the last job filters
 * and a one-time "flash" message for the next page.
 */

import { STORAGE_KEYS } from './config.js';

/* ---------- sessionStorage (per tab, cleared when the tab closes) ---------- */

/** @returns {*} parsed value, or `fallback` when the key is missing or unreadable */
export function getSession(key, fallback = null) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.error(`storage: could not read "${key}"`, error);
    return fallback;
  }
}

/** @returns {{ ok: boolean, error?: string }} */
export function setSession(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    console.error(`storage: could not write "${key}"`, error);
    return { ok: false, error: 'Could not save data in this browser.' };
  }
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
