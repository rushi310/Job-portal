/**
 * dashboard.js — Recruiter dashboard (Phase 8).
 * Built only from the logged-in recruiter's own jobs and the applications to them:
 * stat cards (active jobs, total applicants, shortlisted, pending approval — PROJECT_SPEC §3.3),
 * recent applicants and quick actions. Pending recruiters see the approval banner.
 * Phase 11: applicants per job and the application status funnel (PROJECT_SPEC §3.3).
 */

import {
  ROLES, ROLE_HOME_PATHS, JOB_STATUS, APPLICATION_STATUS, PAGE_PATHS,
} from '../../core/config.js';
import {
  toRoot, getLabel, formatRelativeTime, pluralize,
} from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { createIcon } from '../../components/icons.js';
import { createEmptyState } from '../../components/empty-state.js';
import { renderApprovalBanner } from '../../components/approval-banner.js';
import { NAV_ITEMS } from '../../components/sidebar.js';
import { getOwnJobs, isJobExpired, isActiveRecruiter } from '../../services/job-service.js';
import { getRecruiterApplicants, countApplicationsByStatus } from '../../services/application-service.js';
import { getRecruiterAnalytics } from '../../services/analytics-service.js';
import { renderBarChart } from '../../components/charts.js';

const RECENT_APPLICANTS = 5;
const $ = (selector) => document.querySelector(selector);

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createStatCard({ label, value, icon, tone }) {
  const itemEl = createElement('li', 'card stat-card');
  const iconEl = createElement('span', `stat-card__icon${tone ? ` stat-card__icon--${tone}` : ''}`);
  iconEl.append(createIcon(icon));
  const bodyEl = createElement('div');
  bodyEl.append(createElement('p', 'stat-card__value', value), createElement('p', 'stat-card__label', label));
  itemEl.append(iconEl, bodyEl);
  return itemEl;
}

function renderStats(jobs, applicants) {
  const applications = applicants.map(({ application }) => application);
  const stats = [
    {
      label: 'Active jobs',
      value: jobs.filter((job) => job.status === JOB_STATUS.APPROVED && !isJobExpired(job)).length,
      icon: 'briefcase',
    },
    { label: 'Total applicants', value: applications.length, icon: 'users', tone: 'info' },
    {
      label: 'Shortlisted',
      value: countApplicationsByStatus(applications, APPLICATION_STATUS.SHORTLISTED),
      icon: 'userPlus',
      tone: 'success',
    },
    {
      label: 'Pending approval',
      value: jobs.filter((job) => job.status === JOB_STATUS.PENDING).length,
      icon: 'clock',
      tone: 'warning',
    },
  ];
  $('[data-stats]').replaceChildren(...stats.map((stat) => createStatCard({ ...stat, value: String(stat.value) })));
}

function createApplicantItem({ application, candidateName }, jobsById) {
  const job = jobsById.get(application.jobId);
  const itemEl = createElement('li', 'dashboard-list__item');
  const bodyEl = createElement('div', 'dashboard-list__body');
  const nameEl = createElement('p', 'dashboard-list__title');
  const linkEl = createElement('a', '', candidateName);
  linkEl.href = `${toRoot(PAGE_PATHS.APPLICANTS)}?jobId=${encodeURIComponent(application.jobId)}`;
  nameEl.append(linkEl);
  bodyEl.append(
    nameEl,
    createElement('p', 'dashboard-list__text', job?.title ?? 'Job'),
    createElement('p', 'dashboard-list__meta', `Applied ${formatRelativeTime(application.appliedAt)}`),
  );
  const label = getLabel(application.status) || 'Unknown';
  const badgeEl = createElement('span', `badge badge--status-${application.status}`, label);
  badgeEl.setAttribute('aria-label', `Status: ${label}`);
  itemEl.append(bodyEl, badgeEl);
  return itemEl;
}

function renderRecentApplicants(jobs, applicants, isPending) {
  const containerEl = $('[data-recent-applicants]');
  if (applicants.length === 0) {
    containerEl.replaceChildren(createEmptyState({
      title: 'No applicants yet',
      message: isPending
        ? 'Applicants appear here once your account is approved and your jobs are live.'
        : 'When students apply to your jobs, they appear here.',
      icon: 'users',
    }));
    return;
  }
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const listEl = createElement('ul', 'dashboard-list');
  listEl.setAttribute('role', 'list');
  listEl.append(...applicants.slice(0, RECENT_APPLICANTS).map((item) => createApplicantItem(item, jobsById)));
  containerEl.replaceChildren(listEl);
}

/* ---------- Job-level analytics (Phase 11) ---------- */

function setSummary(selector, text) {
  const summaryEl = $(selector);
  summaryEl.textContent = text;
  summaryEl.hidden = !text;
}

function getJobMeta(job) {
  return [getLabel(job.status), job.isExpired && job.status === JOB_STATUS.APPROVED ? getLabel('expired') : '']
    .filter(Boolean).join(' · ');
}

function renderApplicantsPerJob(analytics) {
  const { jobs, totalApplicants, isActive } = analytics;
  setSummary('[data-per-job-summary]', isActive && totalApplicants > 0
    ? `${pluralize(totalApplicants, 'applicant')} across your ${pluralize(jobs.length, 'job')}, most applied first.`
    : '');
  renderBarChart($('[data-per-job-chart]'), {
    items: jobs.map((job) => ({
      key: job.id,
      tone: 'primary',
      label: job.title,
      meta: getJobMeta(job),
      count: job.count,
      href: `${toRoot(PAGE_PATHS.APPLICANTS)}?jobId=${encodeURIComponent(job.id)}`,
    })),
    valueText: (item) => pluralize(item.count, 'applicant'),
    empty: getAnalyticsEmptyState(analytics, 'Applicant counts for each job appear here.'),
  });
}

function renderFunnel(analytics) {
  const { funnel } = analytics;
  setSummary('[data-funnel-summary]', funnel.total > 0
    ? `How far your ${pluralize(funnel.total, 'application')} have progressed. Each stage counts the applications `
      + 'that reached it, including ones later rejected or withdrawn. Percentages are of all applications.'
    : '');
  renderBarChart($('[data-funnel-chart]'), {
    items: funnel.stages.map((stage) => ({ ...stage, tone: 'primary' })), // one measure, one colour
    empty: getAnalyticsEmptyState(analytics, 'The funnel shows how far applications progress through each stage.'),
  });
}

function getAnalyticsEmptyState({ isActive, jobs }, message) {
  if (!isActive) return { title: 'Available after approval', message: 'Analytics appear once your account is approved.' };
  if (jobs.length === 0) return { title: 'No jobs yet', message: `Post a job to get started. ${message}` };
  return { title: 'No applicants yet', message };
}

function renderAnalytics() {
  const analytics = getRecruiterAnalytics();
  if (!analytics) return;
  renderApplicantsPerJob(analytics);
  renderFunnel(analytics);
}

function renderQuickActions() {
  const items = NAV_ITEMS[ROLES.RECRUITER]
    .filter((item) => item.isAvailable && item.path !== ROLE_HOME_PATHS[ROLES.RECRUITER]);
  $('[data-quick-actions]').replaceChildren(...items.map((item) => {
    const itemEl = createElement('li');
    const linkEl = createElement('a', 'quick-action');
    linkEl.href = toRoot(item.path);
    linkEl.append(createIcon(item.icon), item.label);
    itemEl.append(linkEl);
    return itemEl;
  }));
}

async function init() {
  const user = await initProtectedPage(ROLES.RECRUITER);
  if (!user) return;
  $('[data-user-name]').textContent = user.name;

  const isPending = renderApprovalBanner($('[data-approval-banner]'), user);
  const jobs = getOwnJobs();
  const applicants = isActiveRecruiter(user) ? getRecruiterApplicants() : [];
  renderStats(jobs, applicants);
  renderRecentApplicants(jobs, applicants, isPending);
  renderAnalytics();
  renderQuickActions();
}

init();
