/**
 * pagination.js — Page / limit parsing and the page summary returned with every list.
 */

const { LIMITS } = require('../config/constants');

/** Read ?page=&limit= safely: whole numbers, clamped to sensible bounds. */
function parsePaging(query = {}, { defaultLimit = LIMITS.DEFAULT_PAGE_SIZE, maxLimit = LIMITS.MAX_PAGE_SIZE } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit };
}

/**
 * Describe one page of a list. The page number is clamped into range, so asking for a page
 * past the end returns the last page.
 * @returns {{ page: number, limit: number, total: number, totalPages: number, skip: number }}
 */
function describePage(total, { page, limit }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  return { page: currentPage, limit, total, totalPages, skip: (currentPage - 1) * limit };
}

/** The pagination fields sent to the client (from/to are 1-based positions, 0 when empty). */
function toPageInfo({ page, limit, total, totalPages, skip }, itemCount) {
  return { page, limit, total, totalPages, from: total === 0 ? 0 : skip + 1, to: skip + itemCount };
}

module.exports = { parsePaging, describePage, toPageInfo };
