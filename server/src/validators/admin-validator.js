/**
 * admin-validator.js — Admin inputs (PROJECT_SPEC.md §3.4): rejection reason, announcements and
 * list filters. Also the cover note of an application (PROJECT_SPEC.md §5.3).
 */

const {
  ROLES, USER_STATUS, JOB_STATUS, ANNOUNCEMENT_AUDIENCES, LIMITS,
} = require('../config/constants');
const { text } = require('../utils/text');

/** @returns {string} error message, or '' when the reason is acceptable (BR-09) */
function validateRejectionReason(reason) {
  const value = text(reason);
  if (!value) return 'Please give a reason. The recruiter will see it.';
  return value.length > LIMITS.REJECTION_REASON
    ? `The reason must be ${LIMITS.REJECTION_REASON} characters or fewer.` : '';
}

/** @returns {Object<string, string>} field → message (empty = valid) */
function validateAnnouncement({ audience, title, message } = {}) {
  const errors = {};
  if (!Object.hasOwn(ANNOUNCEMENT_AUDIENCES, text(audience))) errors.audience = 'Please choose who receives it.';
  const titleText = text(title);
  if (!titleText) errors.title = 'Please enter a title.';
  else if (titleText.length > LIMITS.ANNOUNCEMENT_TITLE) {
    errors.title = `The title must be ${LIMITS.ANNOUNCEMENT_TITLE} characters or fewer.`;
  }
  const messageText = text(message);
  if (!messageText) errors.message = 'Please enter a message.';
  else if (messageText.length > LIMITS.ANNOUNCEMENT_MESSAGE) {
    errors.message = `The message must be ${LIMITS.ANNOUNCEMENT_MESSAGE} characters or fewer.`;
  }
  return errors;
}

const pick = (value, allowed) => (allowed.includes(text(value)) ? text(value) : '');

/** User list filters: free-text search plus a known role / status ('' = any). */
function parseUserFilters(query = {}) {
  return {
    query: text(query.query).slice(0, LIMITS.SEARCH_QUERY),
    role: pick(query.role, Object.values(ROLES)),
    status: pick(query.status, Object.values(USER_STATUS)),
  };
}

/** A known job status, or '' for any. */
const parseJobStatus = (value) => pick(value, Object.values(JOB_STATUS));

/** @returns {Object<string, string>} field → message for an application form */
function validateApplicationForm({ coverNote = '' } = {}) {
  if (typeof coverNote !== 'string') return { coverNote: 'Cover note must be text.' };
  if (coverNote.trim().length > LIMITS.COVER_NOTE) {
    return { coverNote: `Cover note can be at most ${LIMITS.COVER_NOTE} characters.` };
  }
  return {};
}

module.exports = {
  validateRejectionReason, validateAnnouncement, parseUserFilters, parseJobStatus, validateApplicationForm,
};
