/**
 * announcements.js — Admin "Announcements" page (Phase 10, PROJECT_SPEC §3.4, §4.5).
 * Audience select, title and message; sending asks for confirmation (it cannot be undone) and
 * creates one notification per recipient through admin-service. The "Sent announcements" list is
 * rebuilt from those notifications.
 */

import { ROLES, ANNOUNCEMENT_AUDIENCES } from '../../core/config.js';
import { formatDate, formatRelativeTime, pluralize } from '../../core/utils.js';
import { initProtectedPage } from '../../components/app-shell.js';
import { setFieldError, setButtonLoading } from '../../components/form-field.js';
import { confirmDialog } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { createEmptyState } from '../../components/empty-state.js';
import {
  validateAnnouncement, sendAnnouncement, getSentAnnouncements,
} from '../../services/admin-service.js';

const FIELDS = ['audience', 'title', 'message'];
const $ = (selector, root = document) => root.querySelector(selector);
let formEl = null;

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const readValues = () => Object.fromEntries(FIELDS.map((field) => [field, formEl.elements[field].value]));

function showAlert(message) {
  const alertEl = $('[data-form-alert]', formEl);
  alertEl.textContent = message;
  alertEl.hidden = !message;
}

function showErrors(fieldErrors) {
  FIELDS.forEach((field) => setFieldError(formEl.elements[field], fieldErrors[field] ?? ''));
  const first = FIELDS.find((field) => fieldErrors[field]);
  if (first) formEl.elements[first].focus();
}

function renderSent() {
  const sent = getSentAnnouncements();
  $('[data-sent-count]').textContent = pluralize(sent.length, 'announcement');
  if (sent.length === 0) {
    $('[data-sent-list]').replaceChildren(createEmptyState({ title: 'No announcements yet', icon: 'megaphone' }));
    return;
  }
  const listEl = createElement('ul', 'dashboard-list');
  listEl.setAttribute('role', 'list');
  listEl.append(...sent.map((item) => {
    const itemEl = createElement('li', 'dashboard-list__item');
    const bodyEl = createElement('div', 'dashboard-list__body');
    const timeEl = createElement('time', '', formatRelativeTime(item.sentAt));
    timeEl.dateTime = item.sentAt;
    timeEl.title = formatDate(item.sentAt);
    const metaEl = createElement('p', 'dashboard-list__meta', `${item.audience} · ${pluralize(item.recipients, 'recipient')} · `);
    metaEl.append(timeEl);
    bodyEl.append(
      createElement('p', 'dashboard-list__title', item.title),
      createElement('p', 'dashboard-list__text', item.message),
      metaEl,
    );
    itemEl.append(bodyEl);
    return itemEl;
  }));
  $('[data-sent-list]').replaceChildren(listEl);
}

async function handleSubmit(event) {
  event.preventDefault();
  const submitEl = $('button[type="submit"]', formEl);
  if (submitEl.disabled) return;
  showAlert('');
  const values = readValues();
  const fieldErrors = validateAnnouncement(values);
  if (Object.keys(fieldErrors).length > 0) {
    showErrors(fieldErrors);
    return;
  }
  showErrors({});
  const audience = ANNOUNCEMENT_AUDIENCES.find((item) => item.value === values.audience);
  const confirmed = await confirmDialog({
    title: 'Send this announcement?',
    message: `"${values.title.trim()}" will be sent to ${audience.label.toLowerCase()}. Sent announcements cannot be edited or recalled.`,
    confirmLabel: 'Send announcement',
    variant: 'primary',
  });
  if (!confirmed) return;

  setButtonLoading(submitEl, true, { idleText: 'Send announcement', loadingText: 'Sending…' });
  const result = sendAnnouncement(values);
  setButtonLoading(submitEl, false, { idleText: 'Send announcement', loadingText: 'Sending…' });
  if (!result.ok) {
    if (result.fieldErrors) showErrors(result.fieldErrors);
    else {
      showAlert(result.error);
      $('[data-form-alert]', formEl).focus();
    }
    return;
  }
  formEl.reset();
  renderSent();
  showToast(`Announcement sent to ${pluralize(result.data.recipients, 'user')}.`, { type: 'success' });
  $('[data-sent-count]').focus();
}

async function init() {
  const user = await initProtectedPage(ROLES.ADMIN);
  if (!user) return;
  formEl = $('[data-announcement-form]');
  const placeholderEl = createElement('option', '', 'Choose an audience');
  placeholderEl.value = '';
  formEl.elements.audience.replaceChildren(placeholderEl, ...ANNOUNCEMENT_AUDIENCES.map((item) => {
    const optionEl = createElement('option', '', item.label);
    optionEl.value = item.value;
    return optionEl;
  }));
  formEl.addEventListener('submit', handleSubmit);
  FIELDS.forEach((field) => {
    const inputEl = formEl.elements[field];
    inputEl.addEventListener('blur', () => {
      if (inputEl.value) setFieldError(inputEl, validateAnnouncement(readValues())[field] ?? '');
    });
    inputEl.addEventListener('input', () => {
      if (inputEl.hasAttribute('aria-invalid')) setFieldError(inputEl, validateAnnouncement(readValues())[field] ?? '');
    });
  });
  renderSent();
}

init();
