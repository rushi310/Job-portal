/**
 * server-status.js — Tells the user when the server is slow to answer.
 * On free hosting the API sleeps when idle and takes up to a minute to wake, so the first request
 * after a quiet period is slow. One toast per page explains the wait instead of a frozen screen.
 */

import { SLOW_REQUEST_EVENT } from '../core/api.js';
import { showToast } from './toast.js';

const SLOW_MESSAGE = 'The server is waking up. This can take up to a minute on free hosting…';
const SLOW_TOAST_MS = 12000;

/** Start listening for slow requests (call once per page). */
export function watchServerStatus() {
  window.addEventListener(SLOW_REQUEST_EVENT, () => {
    showToast(SLOW_MESSAGE, { type: 'info', duration: SLOW_TOAST_MS });
  }, { once: true });
}
