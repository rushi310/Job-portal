/**
 * landing.js — Public landing page (index.html).
 * Seeds demo data on first visit, then renders the stats strip and featured jobs.
 */

import { FEATURED_JOBS_COUNT } from '../core/config.js';
import { ensureSeeded } from '../core/seed.js';
import { consumeFlash } from '../core/storage.js';
import { redirectIfLoggedIn } from '../core/auth.js';
import { getFeaturedJobs, getPublicJobStats, isJobExpired } from '../services/job-service.js';
import { renderPublicNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { createJobCard } from '../components/job-card.js';
import { createEmptyState } from '../components/empty-state.js';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';

const featuredListEl = document.querySelector('[data-featured-jobs]');

/** Replace data-icon placeholders with inline SVG icons. */
function renderStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.replaceChildren(createIcon(el.dataset.icon));
  });
}

function renderStats() {
  const stats = getPublicJobStats();
  document.querySelectorAll('[data-stat]').forEach((el) => {
    el.textContent = String(stats[el.dataset.stat] ?? 0);
  });
}

function renderFeaturedJobs() {
  const jobs = getFeaturedJobs(FEATURED_JOBS_COUNT);

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

/** Shown when seed data can't be loaded (e.g. page opened via file://). */
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

  try {
    const { seeded } = await ensureSeeded();
    if (redirectIfLoggedIn()) return; // already logged in → own dashboard (ARCHITECTURE.md §5)
    renderStats();
    renderFeaturedJobs();
    if (seeded) {
      showToast('Demo data loaded into your browser.', { type: 'success' });
    }
    const flash = consumeFlash(); // e.g. "Welcome back…" after logging in
    if (flash) showToast(flash.message, { type: flash.type });
  } catch (error) {
    console.error('landing: could not load demo data', error);
    renderLoadError(error.message);
    showToast('Could not load demo data.', { type: 'error' });
  }
}

init();
