/**
 * users.js — Admin "Users" page (Phase 9, PROJECT_SPEC §3.4).
 * Search + role/status filters and a table with the actions the rules allow per account:
 * Approve (pending recruiter), Block (active), Unblock (blocked), Delete (with confirmation).
 * The admin's own account and other admin accounts have no actions; the server decides which
 * actions each account allows and checks them again when one is used. Passwords are never sent.
 * ?role=&status= in the URL only preselect the filters.
 */

import {
  ROLES, USER_STATUS, SEARCH_DEBOUNCE_MS,
} from '../../core/config.js';
import {
  getLabel, formatDate, pluralize, debounce, getQueryParam,
} from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { createEmptyState } from '../../components/empty-state.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { watchScrollRegion } from '../../components/scroll-region.js';
import { renderPagination } from '../../components/pagination.js';
import { renderLoading, renderLoadError } from '../../components/load-state.js';
import {
  listUsers, approveRecruiter, blockUser, unblockUser, deleteUser,
} from '../../services/admin-service.js';

const $ = (selector) => document.querySelector(selector);
let formEl = null;
let admin = null;
let users = []; // the page of users last loaded
let currentPage = 1;
let latestRequest = 0; // only the newest search may update the table

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function fillSelect(selectEl, values, anyLabel, selected) {
  const anyEl = createElement('option', '', anyLabel);
  anyEl.value = '';
  selectEl.replaceChildren(anyEl, ...values.map((value) => {
    const optionEl = createElement('option', '', getLabel(value) || value);
    optionEl.value = value;
    return optionEl;
  }));
  selectEl.value = values.includes(selected) ? selected : '';
}

const readFilters = () => ({
  query: formEl.elements.query.value,
  role: formEl.elements.role.value,
  status: formEl.elements.status.value,
});

function createActionButton(label, action, user, className = 'btn btn--outline btn--sm') {
  const buttonEl = createElement('button', className, label);
  buttonEl.type = 'button';
  buttonEl.dataset.userAction = action;
  buttonEl.dataset.userId = user.id;
  buttonEl.setAttribute('aria-label', `${label} ${user.name}`);
  return buttonEl;
}

function createActions(user) {
  const allowed = user.actions ?? {};
  const actionsEl = createElement('div', 'table-actions');
  if (allowed.approve) actionsEl.append(createActionButton('Approve', 'approve', user, 'btn btn--primary btn--sm'));
  if (allowed.block) actionsEl.append(createActionButton('Block', 'block', user));
  if (allowed.unblock) actionsEl.append(createActionButton('Unblock', 'unblock', user));
  if (allowed.remove) {
    actionsEl.append(createActionButton('Delete', 'delete', user, 'btn btn--ghost btn--sm table-actions__danger'));
  }
  if (!actionsEl.children.length) {
    actionsEl.append(createElement('span', 'text-muted text-sm', user.id === admin.id ? 'Your account' : 'Admin account'));
  }
  return actionsEl;
}

function createCell(label, content) {
  const cellEl = createElement('td');
  cellEl.dataset.label = label;
  cellEl.append(content);
  return cellEl;
}

function createRow(user) {
  const rowEl = createElement('tr');
  rowEl.dataset.userId = user.id;
  const nameEl = createElement('th');
  nameEl.scope = 'row';
  nameEl.append(createElement('span', 'jobs-table__title', user.name));
  if (user.companyName) nameEl.append(createElement('span', 'jobs-table__meta', user.companyName));
  const statusLabel = user.role === ROLES.RECRUITER && user.status === USER_STATUS.PENDING
    ? 'Pending approval' : getLabel(user.status) || 'Unknown';
  const badgeEl = createElement('span', `badge badge--status-${user.status}`, statusLabel);
  rowEl.append(
    nameEl,
    createCell('Email', user.email),
    createCell('Role', getLabel(user.role)),
    createCell('Status', badgeEl),
    createCell('Joined', formatDate(user.createdAt)),
    createCell('Actions', createActions(user)),
  );
  return rowEl;
}

/** Load one page of users for the current search and filters, then draw the table. */
async function render() {
  latestRequest += 1;
  const requestId = latestRequest;
  const result = await listUsers({ ...readFilters(), page: currentPage });
  if (requestId !== latestRequest) return; // the filters changed while this request was running
  if (!result.ok) {
    $('[data-users-count]').textContent = '';
    $('[data-users-pagination]').replaceChildren();
    renderLoadError($('[data-users-list]'), { title: 'Users could not be loaded', message: result.error });
    return;
  }
  users = result.data.items;
  currentPage = result.data.page;
  const { total, from, to } = result.data;
  $('[data-users-count]').textContent = total > users.length
    ? `${pluralize(total, 'user')} found · showing ${from}–${to}`
    : `${pluralize(total, 'user')} found`;
  renderPagination($('[data-users-pagination]'), {
    page: currentPage,
    totalPages: result.data.totalPages,
    onChange: (page) => {
      currentPage = page;
      render();
    },
  });
  if (users.length === 0) {
    $('[data-users-list]').replaceChildren(createEmptyState({
      title: 'No users found', message: 'Try another search or filter.', icon: 'users',
    }));
    return;
  }
  const wrapperEl = createElement('div', 'table-wrapper table-wrapper--stack');
  const tableEl = createElement('table', 'table admin-table');
  tableEl.append(createElement('caption', 'visually-hidden', 'Users'));
  const headRowEl = createElement('tr');
  ['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].forEach((label) => {
    const cellEl = createElement('th', '', label);
    cellEl.scope = 'col';
    headRowEl.append(cellEl);
  });
  const headEl = createElement('thead');
  headEl.append(headRowEl);
  const bodyEl = createElement('tbody');
  bodyEl.append(...users.map(createRow));
  tableEl.append(headEl, bodyEl);
  wrapperEl.append(tableEl);
  watchScrollRegion(wrapperEl, 'Users');
  $('[data-users-list]').replaceChildren(wrapperEl);
}

/** Confirmation texts for the destructive actions ("Every destructive action requires confirmation"). */
function getConfirmation(action, user) {
  if (action === 'block') {
    return {
      title: `Block ${user.name}?`,
      message: `${user.name} will not be able to log in, and an open session ends on their next page load. `
        + 'You can unblock the account later.',
      confirmLabel: 'Block account',
    };
  }
  if (action === 'delete') {
    const related = user.role === ROLES.RECRUITER
      ? 'their jobs, every application to those jobs, saved links to those jobs and their notifications'
      : 'their applications, saved jobs and notifications';
    return {
      title: `Delete ${user.name}?`,
      message: `The account and ${related} are removed permanently. This cannot be undone.`,
      confirmLabel: 'Delete user',
    };
  }
  return null;
}

const ACTIONS = {
  approve: { run: approveRecruiter, done: (user) => `${user.name} is approved and can now post jobs.` },
  block: { run: blockUser, done: (user) => `${user.name} is blocked.` },
  unblock: { run: unblockUser, done: (user) => `${user.name} is unblocked.` },
  delete: {
    run: deleteUser,
    done: (user, data) => `${user.name} was deleted`
      + (data.removed.jobs ? ` with ${pluralize(data.removed.jobs, 'job')}` : '') + '.',
  },
};

async function handleAction(buttonEl) {
  const { userAction: action, userId } = buttonEl.dataset;
  const user = users.find((item) => item.id === userId);
  if (!user || !ACTIONS[action]) return;

  const confirmation = getConfirmation(action, user);
  if (confirmation && !(await confirmDialog(confirmation))) return;

  buttonEl.disabled = true; // one request, even on a double click
  const result = await ACTIONS[action].run(userId);
  if (!result.ok) {
    showToast(result.error, { type: 'error' });
    await render();
    return;
  }
  showToast(ACTIONS[action].done(user, result.data), { type: 'success' });
  await render();
  $('[data-users-count]').focus();
}

async function init() {
  const user = await initProtectedPage(ROLES.ADMIN);
  if (!user) return;
  admin = user;
  formEl = $('[data-user-filters]');
  fillSelect(formEl.elements.role, Object.values(ROLES), 'All roles', getQueryParam('role'));
  fillSelect(formEl.elements.status, Object.values(USER_STATUS), 'All statuses', getQueryParam('status'));

  // A new search or filter always starts again from the first page.
  const search = () => {
    currentPage = 1;
    render();
  };
  formEl.addEventListener('submit', (event) => event.preventDefault());
  formEl.elements.query.addEventListener('input', debounce(search, SEARCH_DEBOUNCE_MS));
  formEl.elements.role.addEventListener('change', search);
  formEl.elements.status.addEventListener('change', search);
  $('[data-users-list]').addEventListener('click', (event) => {
    const buttonEl = event.target.closest('[data-user-action]');
    if (buttonEl) handleAction(buttonEl);
  });
  renderLoading($('[data-users-list]'), 'Loading users…');
  await render();
}

init();
