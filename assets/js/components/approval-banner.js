/**
 * approval-banner.js — "Awaiting admin approval" banner for recruiters whose account is still
 * `pending` (PROJECT_SPEC.md §3.3, BR-07). Shown on the recruiter pages that post or manage jobs.
 */

import { ROLES, USER_STATUS } from '../core/config.js';

/**
 * Put the banner into `mountEl` when the recruiter is pending; otherwise leave it empty.
 * @param {HTMLElement|null} mountEl
 * @param {object} user current user
 * @returns {boolean} true when the banner is shown
 */
export function renderApprovalBanner(mountEl, user) {
  if (!mountEl) return false;
  const isPending = user?.role === ROLES.RECRUITER && user.status === USER_STATUS.PENDING;
  if (!isPending) {
    mountEl.replaceChildren();
    return false;
  }
  const bannerEl = document.createElement('div');
  bannerEl.className = 'alert alert--warning approval-banner';
  bannerEl.setAttribute('role', 'status');
  const titleEl = document.createElement('strong');
  titleEl.textContent = 'Awaiting admin approval. ';
  bannerEl.append(titleEl,
    'Your recruiter account is being reviewed. You can complete your company profile now; '
    + 'posting and managing jobs unlocks once an admin approves your account.');
  mountEl.replaceChildren(bannerEl);
  return true;
}
