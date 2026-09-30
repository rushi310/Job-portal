/**
 * dashboard.js — Recruiter dashboard shell (Phase 2): guarded app layout + welcome message.
 * The full dashboard content is built in Phase 8.
 */

import { ROLES } from '../../core/config.js';
import { initProtectedPage } from '../../components/app-shell.js';

async function init() {
  const user = await initProtectedPage(ROLES.RECRUITER);
  if (!user) return;
  document.querySelector('[data-user-name]').textContent = user.name;
}

init();
