/**
 * modal.js — Accessible dialog: focus trap, Esc/backdrop to close, focus returned to the trigger.
 */

import { createIcon } from './icons.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let modalCount = 0;

/**
 * Open a modal dialog.
 * @param {object} options
 * @param {string} options.title
 * @param {string|Node} options.content plain text (rendered as a paragraph) or a DOM node
 * @param {Array<{label: string, variant?: string, onClick?: Function, closeOnClick?: boolean}>} [options.actions]
 * @param {Function} [options.onClose]
 * @returns {{ close: Function, element: HTMLElement }}
 */
export function openModal({ title, content, actions = [{ label: 'Close', variant: 'primary' }], onClose }) {
  const previouslyFocused = document.activeElement;
  const titleId = `modal-title-${++modalCount}`;

  const modalEl = document.createElement('div');
  modalEl.className = 'modal';

  const backdropEl = document.createElement('div');
  backdropEl.className = 'modal__backdrop';

  const dialogEl = document.createElement('div');
  dialogEl.className = 'modal__dialog';
  dialogEl.setAttribute('role', 'dialog');
  dialogEl.setAttribute('aria-modal', 'true');
  dialogEl.setAttribute('aria-labelledby', titleId);

  const headerEl = document.createElement('div');
  headerEl.className = 'modal__header';
  const titleEl = document.createElement('h2');
  titleEl.className = 'modal__title';
  titleEl.id = titleId;
  titleEl.textContent = title;
  const closeBtnEl = document.createElement('button');
  closeBtnEl.type = 'button';
  closeBtnEl.className = 'icon-btn';
  closeBtnEl.setAttribute('aria-label', 'Close dialog');
  closeBtnEl.append(createIcon('close'));
  headerEl.append(titleEl, closeBtnEl);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal__body';
  if (content instanceof Node) {
    bodyEl.append(content);
  } else {
    const paragraphEl = document.createElement('p');
    paragraphEl.textContent = content ?? '';
    bodyEl.append(paragraphEl);
  }

  dialogEl.append(headerEl, bodyEl);

  function close() {
    if (!modalEl.isConnected) return;
    document.removeEventListener('keydown', handleKeydown);
    modalEl.remove();
    if (!document.querySelector('.modal')) document.body.classList.remove('has-modal');
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    if (onClose) onClose();
  }

  if (actions.length > 0) {
    const footerEl = document.createElement('div');
    footerEl.className = 'modal__footer';
    actions.forEach(({ label, variant = 'secondary', onClick, closeOnClick = true }) => {
      const buttonEl = document.createElement('button');
      buttonEl.type = 'button';
      buttonEl.className = `btn btn--${variant}`;
      buttonEl.textContent = label;
      buttonEl.addEventListener('click', () => {
        if (onClick) onClick();
        if (closeOnClick) close();
      });
      footerEl.append(buttonEl);
    });
    dialogEl.append(footerEl);
  }

  /** Esc closes; Tab/Shift+Tab stay inside the dialog. */
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogEl.querySelectorAll(FOCUSABLE)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  closeBtnEl.addEventListener('click', close);
  backdropEl.addEventListener('click', close);
  document.addEventListener('keydown', handleKeydown);

  modalEl.append(backdropEl, dialogEl);
  document.body.append(modalEl);
  document.body.classList.add('has-modal');

  const firstAction = dialogEl.querySelector('.modal__footer .btn') ?? closeBtnEl;
  firstAction.focus();

  return { close, element: modalEl };
}

/**
 * Ask the user to confirm an action (used for destructive actions in later phases).
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', variant = 'danger' }) {
  return new Promise((resolve) => {
    let confirmed = false;
    openModal({
      title,
      content: message,
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        { label: confirmLabel, variant, onClick: () => { confirmed = true; } },
      ],
      onClose: () => resolve(confirmed),
    });
  });
}
