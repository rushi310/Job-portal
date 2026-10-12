/**
 * file-viewer.js — View or download a private file (a PDF resume) that is fetched with the login
 * token. The file is turned into a temporary in-browser (blob:) URL, so it never has a public
 * address.
 */

import { showToast } from './toast.js';

const REVOKE_AFTER_MS = 60000; // time for the new tab to load the file

function saveFile(url, fileName) {
  const linkEl = document.createElement('a');
  linkEl.href = url;
  linkEl.download = fileName;
  document.body.append(linkEl);
  linkEl.click();
  linkEl.remove();
}

/**
 * Fetch a file and show it in a new tab, or download it.
 * To view, the tab is opened immediately (while the click still counts as a user action, so the
 * browser's pop-up blocker allows it) and pointed at the file once it has arrived.
 * @param {() => Promise<{ ok: true, data: Blob } | { ok: false, error: string }>} fetchFile
 * @param {{ download?: boolean, fileName?: string }} [options]
 */
export async function openFile(fetchFile, { download = false, fileName = 'resume.pdf' } = {}) {
  const tab = download ? null : window.open('', '_blank');
  const result = await fetchFile();
  if (!result.ok) {
    if (tab) tab.close();
    showToast(result.error, { type: 'error' });
    return;
  }
  const url = URL.createObjectURL(result.data);
  if (tab) tab.location.replace(url);
  else saveFile(url, fileName); // also the fallback when the browser refused to open a tab
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
