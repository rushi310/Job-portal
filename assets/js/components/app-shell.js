/**
 * app-shell.js — Start-up for every logged-in page: load demo data, run the page guard,
 * then render the navbar, sidebar and footer and show any one-time (flash) message.
 * Markup contract: `[data-app-shell]` (starts `hidden`) containing `[data-mount="navbar"]`,
 * `[data-mount="sidebar"]` and `[data-mount="footer"]`.
 */

import { ensureSeeded } from '../core/seed.js';
import { requireRole } from '../core/auth.js';
import { consumeFlash } from '../core/storage.js';
import { renderAppNavbar } from './navbar.js';
import { renderSidebar } from './sidebar.js';
import { renderFooter } from './footer.js';
import { showToast } from './toast.js';
import { getUnreadCount } from '../services/notification-service.js';

/** Shown instead of the page when demo data can't load (nothing protected is revealed). */
function showStartupError(message) {
  const alertEl = document.createElement('div');
  alertEl.className = 'alert alert--danger container mt-6';
  alertEl.setAttribute('role', 'alert');
  alertEl.textContent = message;
  document.body.append(alertEl);
}

/**
 * Guard and render a protected page.
 * @param {...string} roles roles allowed on the page
 * @returns {Promise<object|null>} the current user, or null if the page must not render
 */
export async function initProtectedPage(...roles) {
  try {
    await ensureSeeded();
  } catch (error) {
    console.error('app-shell: could not load demo data', error);
    showStartupError(error.message);
    return null;
  }

  const user = requireRole(...roles);
  if (!user) return null; // redirect in progress; the shell stays hidden

  const sidebar = renderSidebar(document.querySelector('[data-mount="sidebar"]'), user);
  renderAppNavbar(document.querySelector('[data-mount="navbar"]'), user, { sidebar, unreadCount: getUnreadCount() });
  renderFooter(document.querySelector('[data-mount="footer"]'));
  document.querySelector('[data-app-shell]').hidden = false;

  const flash = consumeFlash(); // e.g. "Welcome back…" after logging in
  if (flash) showToast(flash.message, { type: flash.type });
  return user;
}
