/**
 * landing.js — Public landing page (index.html).
 * Renders the stats strip and the newest open jobs from the API's public landing data.
 */

import { consumeFlash } from '../core/storage.js';
import { redirectIfLoggedIn } from '../core/auth.js';
import { getLandingData, isJobExpired } from '../services/job-service.js';
import { renderPublicNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { createJobCard } from '../components/job-card.js';
import { createEmptyState } from '../components/empty-state.js';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { watchServerStatus } from '../components/server-status.js';

const featuredListEl = document.querySelector('[data-featured-jobs]');

/** Replace data-icon placeholders with inline SVG icons. */
function renderStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.replaceChildren(createIcon(el.dataset.icon));
  });
}

function renderStats(stats) {
  document.querySelectorAll('[data-stat]').forEach((el) => {
    el.textContent = String(stats[el.dataset.stat] ?? 0);
  });
}

function renderFeaturedJobs(jobs) {
  if (jobs.length === 0) {
    featuredListEl.replaceChildren(createEmptyState({
      icon: 'briefcase',
      title: 'No open jobs right now',
      message: 'New openings for freshers are added regularly. Please check back soon.',
    }));
  } else {
    featuredListEl.replaceChildren(
      ...jobs.map((job) => createJobCard(job, { isExpired: isJobExpired(job) })),
    );
  }
  featuredListEl.setAttribute('aria-busy', 'false');
}

/** Shown when the jobs can't be loaded (e.g. the server is unreachable). */
function renderLoadError(message) {
  const alertEl = document.createElement('div');
  alertEl.className = 'alert alert--danger';
  alertEl.setAttribute('role', 'alert');
  const textEl = document.createElement('p');
  textEl.textContent = message;
  alertEl.append(createIcon('alert'), textEl);
  featuredListEl.replaceChildren(alertEl);
  featuredListEl.setAttribute('aria-busy', 'false');
}

async function init() {
  renderPublicNavbar(document.querySelector('[data-mount="navbar"]'));
  renderFooter(document.querySelector('[data-mount="footer"]'));
  renderStaticIcons();
  watchServerStatus();

  if (await redirectIfLoggedIn()) return; // already logged in → own dashboard (ARCHITECTURE.md §5)
  const flash = consumeFlash(); // e.g. "You have been logged out."
  if (flash) showToast(flash.message, { type: flash.type });

  const result = await getLandingData();
  if (!result.ok) {
    console.error('landing: could not load jobs', result.code);
    renderLoadError(result.error);
    return;
  }
  renderStats(result.data.stats);
  renderFeaturedJobs(result.data.featuredJobs);
}

init();
