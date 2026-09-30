/**
 * reports.js — Admin "Reports" page (Phase 11; PROJECT_SPEC §3.4, UI_SPEC §5 "Reports").
 * Four reports built from the current stored data by analytics-service: users by role (donut),
 * jobs by status and applications by status (bars), applications over time (line). Each chart has
 * a text summary and a table with the same numbers, and each report can be exported as CSV
 * (downloaded in the browser from a Blob — nothing leaves the browser).
 * The page re-renders when another tab changes the data (`storage` event).
 */

import { ROLES } from '../../core/config.js';
import { formatDate, pluralize } from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { renderBarChart, renderDonutChart, renderLineChart } from '../../components/charts.js';
import { showToast } from '../../components/toast.js';
import { watchScrollRegion } from '../../components/scroll-region.js';
import { getPlatformReport, getReportCsv, REPORTS } from '../../services/analytics-service.js';

const $ = (selector, root = document) => root.querySelector(selector);

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** A table row: the first cell is the row header. */
function createRow(cells) {
  const rowEl = createElement('tr');
  cells.forEach((cell, index) => {
    const cellEl = createElement(index === 0 ? 'th' : 'td', '', String(cell));
    if (index === 0) cellEl.scope = 'row';
    rowEl.append(cellEl);
  });
  return rowEl;
}

/**
 * Data table shown under a chart (its text alternative).
 * @param {{ caption: string, headings: Array<string>, rows: Array<Array>, footer?: Array }} table
 */
function createTable({ caption, headings, rows, footer }) {
  const tableEl = createElement('table', 'table');
  tableEl.append(createElement('caption', '', caption));
  const headRowEl = createElement('tr');
  headRowEl.append(...headings.map((heading) => {
    const cellEl = createElement('th', '', heading);
    cellEl.scope = 'col';
    return cellEl;
  }));
  const headEl = createElement('thead');
  headEl.append(headRowEl);
  const bodyEl = createElement('tbody');
  bodyEl.append(...rows.map((row) => createRow(row)));
  tableEl.append(headEl, bodyEl);
  if (footer) {
    const footEl = createElement('tfoot');
    footEl.append(createRow(footer));
    tableEl.append(footEl);
  }
  const wrapperEl = createElement('div', 'table-wrapper report-table');
  wrapperEl.append(tableEl);
  watchScrollRegion(wrapperEl, caption);
  return wrapperEl;
}

/** "15 applications in total: Applied 5 (33%), …" — only the categories that have records. */
function describeCategories({ total, items }, noun) {
  if (total === 0) return `No ${noun}s yet.`;
  const parts = items.filter((item) => item.count > 0)
    .map((item) => `${item.label} ${item.count} (${item.percent}%)`);
  return `${pluralize(total, noun)} in total: ${parts.join(', ')}.`;
}

function categoryTable(title, heading, countHeading, { total, items }) {
  return createTable({
    caption: `${title} (table)`,
    headings: [heading, countHeading, 'Percent'],
    rows: items.map((item) => [item.label, item.count, `${item.percent}%`]),
    footer: ['Total', total, total > 0 ? '100%' : '0%'],
  });
}

function describeTimeline({ unit, total, invalid, points }) {
  const invalidText = invalid > 0
    ? ` ${pluralize(invalid, 'application')} with a missing or invalid date ${invalid === 1 ? 'is' : 'are'} not on the chart.`
    : '';
  if (total === 0) return `No dated applications yet.${invalidText}`;
  const busiest = points.reduce((best, point) => (point.count > best.count ? point : best), points[0]);
  const from = unit === 'week' ? formatDate(points[0].key) : points[0].label;
  return `${pluralize(total, 'application')} from ${from} to today, grouped by ${unit}. `
    + `Busiest ${unit}: ${busiest.label} (${busiest.count}).${invalidText}`;
}

/** What each report section shows: summary text, chart and table. */
const SECTION_RENDERERS = {
  'users-by-role': (sectionEl, report) => {
    $('[data-summary]', sectionEl).textContent = describeCategories(report.usersByRole, 'user');
    renderDonutChart($('[data-chart]', sectionEl), {
      items: report.usersByRole.items,
      centerLabel: 'users',
      empty: { title: 'No users yet' },
    });
    $('[data-table]', sectionEl).replaceChildren(categoryTable('Users by role', 'Role', 'Users', report.usersByRole));
  },
  'jobs-by-status': (sectionEl, report) => {
    $('[data-summary]', sectionEl).textContent = describeCategories(report.jobsByStatus, 'job');
    renderBarChart($('[data-chart]', sectionEl), {
      items: report.jobsByStatus.items,
      empty: { title: 'No jobs yet', message: 'Jobs appear here once recruiters post them.' },
    });
    $('[data-table]', sectionEl).replaceChildren(categoryTable('Jobs by status', 'Status', 'Jobs', report.jobsByStatus));
  },
  'applications-by-status': (sectionEl, report) => {
    $('[data-summary]', sectionEl).textContent = describeCategories(report.applicationsByStatus, 'application');
    renderBarChart($('[data-chart]', sectionEl), {
      items: report.applicationsByStatus.items,
      empty: { title: 'No applications yet', message: 'Applications appear here once students apply.' },
    });
    $('[data-table]', sectionEl).replaceChildren(
      categoryTable('Applications by status', 'Status', 'Applications', report.applicationsByStatus),
    );
  },
  'applications-over-time': (sectionEl, report) => {
    const timeline = report.applicationsOverTime;
    $('[data-summary]', sectionEl).textContent = describeTimeline(timeline);
    renderLineChart($('[data-chart]', sectionEl), {
      points: timeline.points,
      empty: { title: 'No applications yet', message: 'The timeline starts with the first application.' },
    });
    const footer = ['Total', timeline.total + timeline.invalid];
    const rows = timeline.points.map((point) => [point.label, point.count]);
    if (timeline.invalid > 0) rows.push(['Date missing or invalid', timeline.invalid]);
    $('[data-table]', sectionEl).replaceChildren(createTable({
      caption: 'Applications over time (table)',
      headings: [timeline.unit === 'week' ? 'Week' : 'Month', 'Applications'],
      rows,
      footer,
    }));
  },
};

/** Render one report; a failure only affects that section. */
function renderSection(sectionEl, report) {
  try {
    SECTION_RENDERERS[sectionEl.dataset.report](sectionEl, report);
  } catch (error) {
    console.error('reports: section failed to render', error);
    const alertEl = createElement('p', 'alert alert--warning', 'This report could not be loaded right now.');
    alertEl.setAttribute('role', 'status');
    $('[data-chart]', sectionEl).replaceChildren(alertEl);
  }
}

function render() {
  const report = getPlatformReport();
  if (!report) return; // session ended (e.g. in another tab); the next page load redirects
  document.querySelectorAll('[data-report]').forEach((sectionEl) => renderSection(sectionEl, report));
}

function downloadFile(fileName, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const linkEl = createElement('a');
  linkEl.href = url;
  linkEl.download = fileName;
  linkEl.hidden = true;
  document.body.append(linkEl);
  linkEl.click();
  linkEl.remove();
  // Give the browser time to start the download before the temporary URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function handleExportClick(event) {
  const buttonEl = event.target.closest('[data-export]');
  if (!buttonEl) return;
  const reportKey = buttonEl.dataset.export;
  const csv = getReportCsv(reportKey);
  if (!csv) {
    showToast('This report could not be exported. Please reload the page and try again.', { type: 'error' });
    return;
  }
  downloadFile(csv.fileName, csv.content);
  showToast(`${REPORTS[reportKey].title} exported as ${csv.fileName}.`, { type: 'success' });
}

async function init() {
  const user = await initProtectedPage(ROLES.ADMIN);
  if (!user) return;
  render();
  $('main').addEventListener('click', handleExportClick);
  // Another tab changed the data (e.g. a student applied): recalculate every report.
  window.addEventListener('storage', render);
}

init();
