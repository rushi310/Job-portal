/**
 * profile-service.js — The logged-in user's own profile: student profile and resume, recruiter
 * company profile. The server always edits the account the login token belongs to; pages never
 * pass a user id. The rules here give quick feedback in the forms; the server applies the same
 * rules and copies only the fields a section may change.
 */

import {
  PROFILE_LIMITS, PROFILE_LINK_FIELDS, MAX_RESUME_SIZE, RESUME_MIME_TYPE, COMPANY_SIZE_OPTIONS,
} from '../core/config.js';
import * as api from '../core/api.js';
import { validateRegistrationField, isValidUrl } from './user-service.js';

/** The editable sections, one per Profile tab (the Resume tab uses uploadResume/removeResume). */
export const PROFILE_SECTIONS = Object.freeze({
  PERSONAL: 'personal',
  EDUCATION: 'education',
  SKILLS: 'skills',
  PROJECTS: 'projects',
});

/** Error codes returned in `{ ok: false, code, error }` results. */
export const PROFILE_ERRORS = Object.freeze({
  NOT_ALLOWED: 'NOT_ALLOWED',
  INVALID_SECTION: 'INVALID_SECTION',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_FILE: 'INVALID_FILE',
  NO_RESUME: 'NO_RESUME',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
});

const CURRENT_YEAR = new Date().getFullYear();
const MAX_EDUCATION_YEAR = CURRENT_YEAR + 5; // allows courses that are still in progress

const text = (value) => String(value ?? '').trim();
const firstError = (...messages) => messages.find(Boolean) ?? '';

/* ==========================================================================
   Form rules
   ========================================================================== */

const tooLong = (label, limit) => (value) => (
  text(value).length > limit ? `${label} must be ${limit} characters or fewer.` : ''
);
const requiredText = (label, limit, message) => (value) => (
  text(value) ? tooLong(label, limit)(value) : message
);
/** Registration's rule for the same field (same messages and conventions as sign-up). */
const registrationRule = (field) => (value) => validateRegistrationField(field, { [field]: value });
const optionalUrl = (label) => (value) => (
  !text(value) || isValidUrl(text(value))
    ? ''
    : `Please enter a valid ${label} link starting with https:// (or http://).`
);

/**
 * One rule per field. Repeated entries use "section.field" keys (e.g. "education.level");
 * their errors are reported as "section.<index>.field".
 */
const FIELD_RULES = {
  name: (value) => firstError(registrationRule('name')(value), tooLong('Full name', PROFILE_LIMITS.SHORT_TEXT)(value)),
  phone: registrationRule('phone'),
  location: tooLong('Location', PROFILE_LIMITS.SHORT_TEXT),
  about: tooLong('About you', PROFILE_LIMITS.ABOUT),

  college: (value) => firstError(registrationRule('college')(value), tooLong('College', PROFILE_LIMITS.SHORT_TEXT)(value)),
  degree: registrationRule('degree'),
  branch: (value) => firstError(registrationRule('branch')(value), tooLong('Branch', PROFILE_LIMITS.SHORT_TEXT)(value)),
  graduationYear: registrationRule('graduationYear'),
  cgpa: registrationRule('cgpa'),

  'education.level': requiredText('Level', PROFILE_LIMITS.LEVEL, 'Please enter the level, e.g. HSC or Diploma.'),
  'education.institute': requiredText('Institute', PROFILE_LIMITS.SHORT_TEXT, 'Please enter the school or institute.'),
  'education.year': (value) => {
    if (!text(value)) return 'Please enter the year of passing.';
    const year = Number(value);
    return Number.isInteger(year) && year >= PROFILE_LIMITS.MIN_EDUCATION_YEAR && year <= MAX_EDUCATION_YEAR
      ? ''
      : `Please enter a year between ${PROFILE_LIMITS.MIN_EDUCATION_YEAR} and ${MAX_EDUCATION_YEAR}.`;
  },
  'education.score': tooLong('Score', PROFILE_LIMITS.SCORE),

  'projects.title': requiredText('Project title', PROFILE_LIMITS.SHORT_TEXT, 'Please enter the project title.'),
  'projects.description': tooLong('Description', PROFILE_LIMITS.PROJECT_DESCRIPTION),
  'projects.link': optionalUrl('project'),

  ...Object.fromEntries(PROFILE_LINK_FIELDS.map(({ name, label }) => [`links.${name}`, optionalUrl(label)])),
};

/**
 * Validate one field (used on blur).
 * @param {string} field e.g. "phone", "education.year", "links.github"
 * @returns {string} error message, or '' when valid
 */
export function validateProfileField(field, value) {
  const rule = FIELD_RULES[field];
  return rule ? rule(value) : '';
}

/**
 * Can this skill be added to the list? Empty, too long and duplicate (any letter case) skills are refused.
 * @param {string} skill
 * @param {string[]} skills the current list
 * @returns {string} error message, or '' when it can be added
 */
export function validateNewSkill(skill, skills = []) {
  const value = text(skill);
  if (!value) return 'Please type a skill to add.';
  if (value.length > PROFILE_LIMITS.SKILL) return `A skill must be ${PROFILE_LIMITS.SKILL} characters or fewer.`;
  if (skills.some((existing) => text(existing).toLowerCase() === value.toLowerCase())) {
    return `"${value}" is already in your skills.`;
  }
  if (skills.length >= PROFILE_LIMITS.MAX_SKILLS) return `You can add up to ${PROFILE_LIMITS.MAX_SKILLS} skills.`;
  return '';
}

/** Adds "field" errors for each simple field in `fields`. */
function collectFieldErrors(fields, values) {
  return fields.reduce((errors, field) => {
    const message = validateProfileField(field, values[field]);
    return message ? { ...errors, [field]: message } : errors;
  }, {});
}

/** Errors for a list of entries, keyed "section.<index>.field". */
function collectEntryErrors(section, fields, entries, maxCount, noun) {
  if (!Array.isArray(entries)) return { [section]: `Please check your ${noun} entries.` };
  if (entries.length > maxCount) return { [section]: `You can add up to ${maxCount} ${noun} entries.` };
  return entries.reduce((errors, entry, index) => {
    fields.forEach((field) => {
      const message = validateProfileField(`${section}.${field}`, entry?.[field]);
      if (message) errors[`${section}.${index}.${field}`] = message;
    });
    return errors;
  }, {});
}

function collectSkillErrors(skills) {
  if (!Array.isArray(skills)) return { skills: 'Please check your skills.' };
  const accepted = [];
  for (const skill of skills) {
    const message = validateNewSkill(skill, accepted);
    if (message) return { skills: message };
    accepted.push(text(skill));
  }
  return {};
}

const SECTION_VALIDATORS = {
  [PROFILE_SECTIONS.PERSONAL]: (values) => collectFieldErrors(['name', 'phone', 'location', 'about'], values),
  [PROFILE_SECTIONS.EDUCATION]: (values) => ({
    ...collectFieldErrors(['college', 'degree', 'branch', 'graduationYear', 'cgpa'], values),
    ...collectEntryErrors('education', ['level', 'institute', 'year', 'score'], values.education,
      PROFILE_LIMITS.MAX_EDUCATION, 'education'),
  }),
  [PROFILE_SECTIONS.SKILLS]: (values) => collectSkillErrors(values.skills),
  [PROFILE_SECTIONS.PROJECTS]: (values) => ({
    ...collectEntryErrors('projects', ['title', 'description', 'link'], values.projects,
      PROFILE_LIMITS.MAX_PROJECTS, 'project'),
    ...collectFieldErrors(
      PROFILE_LINK_FIELDS.map(({ name }) => `links.${name}`),
      Object.fromEntries(PROFILE_LINK_FIELDS.map(({ name }) => [`links.${name}`, values.links?.[name]])),
    ),
  }),
};

/**
 * Validate one Profile tab.
 * @returns {Object<string, string>} field key → message (empty object = valid)
 */
export function validateProfileSection(section, values = {}) {
  const validator = SECTION_VALIDATORS[section];
  return validator ? validator(values) : {};
}

/** The result for a form that failed the checks here (same shape as the server's answer). */
function validationFailure(fieldErrors) {
  return {
    ok: false, code: PROFILE_ERRORS.VALIDATION_FAILED, error: 'Please correct the highlighted fields.', fieldErrors,
  };
}

/**
 * Validate and save one Profile tab for the logged-in student. Obvious mistakes are reported
 * straight away; the server validates again before saving.
 * @param {string} section one of PROFILE_SECTIONS
 * @param {object} values the tab's form values
 * @returns {Promise<{ ok: true, data: object }
 *   | { ok: false, code: string, error: string, fieldErrors?: Object<string, string> }>} data = updated user
 */
export async function updateProfileSection(section, values = {}) {
  const fieldErrors = validateProfileSection(section, values);
  if (Object.keys(fieldErrors).length > 0) return validationFailure(fieldErrors);
  return api.patch(`/student/profile/${encodeURIComponent(section)}`, values);
}

/* ==========================================================================
   Resume (PDF ≤ 500 KB, kept on the server — PROJECT_SPEC.md §3.2, §5.1)
   ========================================================================== */

/** "12.3 KB" style size for messages and the resume card. */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  const kilobytes = bytes / 1024;
  return kilobytes < 1024 ? `${Number(kilobytes.toFixed(1))} KB` : `${Number((kilobytes / 1024).toFixed(1))} MB`;
}

/**
 * Check a chosen file before sending it (the server checks the real content again).
 * @param {File|null} file
 * @returns {string} error message, or '' when the file can be uploaded
 */
export function validateResumeFile(file) {
  if (!file) return 'Please choose a PDF file to upload.';
  if (file.type !== RESUME_MIME_TYPE) return 'Only PDF files can be uploaded. Please choose a .pdf file.';
  if (file.size === 0) return 'This file is empty. Please choose another PDF.';
  if (file.size > MAX_RESUME_SIZE) {
    return `This file is ${formatFileSize(file.size)}. The maximum size is ${formatFileSize(MAX_RESUME_SIZE)}.`;
  }
  return '';
}

/**
 * Upload or replace the logged-in student's resume. If anything fails the previous resume is
 * kept, because the server replaces it only after the new file passed every check.
 * @param {File} file
 * @returns {Promise<{ ok: true, data: object } | { ok: false, code: string, error: string }>} data = updated user
 */
export async function uploadResume(file) {
  const message = validateResumeFile(file);
  if (message) return { ok: false, code: PROFILE_ERRORS.INVALID_FILE, error: message };

  const result = await api.request('PUT', '/student/resume', {
    file,
    // The file name travels in a header (URL-encoded, so any characters are safe to send).
    headers: { 'Content-Type': RESUME_MIME_TYPE, 'X-File-Name': encodeURIComponent(text(file.name) || 'resume.pdf') },
  });
  if (!result.ok && result.code === PROFILE_ERRORS.PAYLOAD_TOO_LARGE) {
    return { ...result, code: PROFILE_ERRORS.INVALID_FILE, error: `This file is too large. The maximum size is ${formatFileSize(MAX_RESUME_SIZE)}.` };
  }
  return result;
}

/**
 * Remove the logged-in student's resume. Past applications keep their recorded file name (BR-17).
 * @returns {Promise<{ ok: true, data: object } | { ok: false, code: string, error: string }>} data = updated user
 */
export function removeResume() {
  return api.del('/student/resume');
}

/**
 * Display details of a student's resume (never the file itself).
 * @param {object} user
 * @returns {null | { fileName: string, fileType: string, sizeBytes: number, uploadedAt: string }}
 */
export function getResumeInfo(user) {
  const resume = user?.profile?.resume;
  if (!resume || typeof resume.fileName !== 'string') return null;
  return {
    fileName: resume.fileName,
    fileType: 'PDF',
    sizeBytes: Number.isFinite(resume.sizeBytes) ? resume.sizeBytes : 0,
    uploadedAt: typeof resume.uploadedAt === 'string' ? resume.uploadedAt : '',
  };
}

/**
 * The logged-in student's own resume as a PDF Blob, for viewing or downloading.
 * @returns {Promise<{ ok: true, data: Blob } | { ok: false, code: string, error: string }>}
 */
export function getOwnResumeFile() {
  return api.download('/student/resume');
}

/* ==========================================================================
   Recruiter company profile — PROJECT_SPEC.md §5.1 "Recruiter profile"
   ========================================================================== */

/** Editable fields on Company Profile: contact (user) fields + the recruiter `profile` fields. */
export const COMPANY_PROFILE_FIELDS = Object.freeze([
  'name', 'phone', 'companyName', 'designation', 'companyWebsite', 'companyLocation',
  'companySize', 'industry', 'about',
]);

const COMPANY_FIELD_RULES = {
  name: FIELD_RULES.name,
  phone: FIELD_RULES.phone,
  companyName: (value) => firstError(registrationRule('companyName')(value), tooLong('Company name', PROFILE_LIMITS.SHORT_TEXT)(value)),
  designation: (value) => firstError(registrationRule('designation')(value), tooLong('Designation', PROFILE_LIMITS.SHORT_TEXT)(value)),
  companyWebsite: (value) => firstError(registrationRule('companyWebsite')(value), tooLong('Website', PROFILE_LIMITS.SHORT_TEXT * 2)(value)),
  companyLocation: (value) => firstError(registrationRule('companyLocation')(value), tooLong('Company location', PROFILE_LIMITS.SHORT_TEXT)(value)),
  companySize: (value) => (!text(value) || COMPANY_SIZE_OPTIONS.includes(value) ? '' : 'Please choose a company size from the list.'),
  industry: tooLong('Industry', PROFILE_LIMITS.SHORT_TEXT),
  about: tooLong('About the company', PROFILE_LIMITS.ABOUT),
};

/** @returns {string} error message, or '' when valid */
export function validateCompanyField(field, value) {
  const rule = COMPANY_FIELD_RULES[field];
  return rule ? rule(value) : '';
}

/**
 * Validate and save the logged-in recruiter's contact and company details. Pending recruiters may
 * do this too (it does not post anything); email, role and status never change here.
 * @param {object} values form values
 * @returns {Promise<{ ok: true, data: object }
 *   | { ok: false, code: string, error: string, fieldErrors?: Object<string, string> }>} data = updated user
 */
export async function updateCompanyProfile(values = {}) {
  const fieldErrors = COMPANY_PROFILE_FIELDS.reduce((errors, field) => {
    const message = validateCompanyField(field, values[field]);
    return message ? { ...errors, [field]: message } : errors;
  }, {});
  if (Object.keys(fieldErrors).length > 0) return validationFailure(fieldErrors);
  return api.patch('/recruiter/profile', values);
}
