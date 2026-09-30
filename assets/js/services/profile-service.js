/**
 * profile-service.js — The logged-in user's own profile: student profile and resume (Phase 7),
 * recruiter company profile (Phase 8).
 * The user is always taken from the session (getCurrentUser); pages never pass a user id.
 * Each Profile tab saves one section, and only that section's fields change (user-service.js
 * keeps id, role, email, password, status and createdAt untouched).
 */

import {
  ROLES, PROFILE_LIMITS, PROFILE_LINK_FIELDS, MAX_RESUME_SIZE, RESUME_MIME_TYPE, COMPANY_SIZE_OPTIONS,
} from '../core/config.js';
import { getCurrentUser } from '../core/auth.js';
import {
  validateRegistrationField, updateStudentRecord, updateRecruiterRecord, isValidUrl,
} from './user-service.js';

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
  CORRUPTED_RESUME: 'CORRUPTED_RESUME',
  STORAGE_ERROR: 'STORAGE_ERROR',
});

const PDF_DATA_URL_PREFIX = `data:${RESUME_MIME_TYPE};base64,`;
const CURRENT_YEAR = new Date().getFullYear();
const MAX_EDUCATION_YEAR = CURRENT_YEAR + 5; // allows courses that are still in progress

function failure(code, error, extra = {}) {
  return { ok: false, code, error, ...extra };
}

const text = (value) => String(value ?? '').trim();
const firstError = (...messages) => messages.find(Boolean) ?? '';

/** @returns {object|null} the logged-in student, or null for anyone else */
function getStudent() {
  const user = getCurrentUser();
  return user?.role === ROLES.STUDENT ? user : null;
}

/* ==========================================================================
   Validation
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

/* ==========================================================================
   Saving a section (only whitelisted fields are copied)
   ========================================================================== */

const SECTION_BUILDERS = {
  [PROFILE_SECTIONS.PERSONAL]: (values, profile) => ({
    name: text(values.name),
    phone: text(values.phone),
    profile: { ...profile, location: text(values.location), about: text(values.about) },
  }),
  [PROFILE_SECTIONS.EDUCATION]: (values, profile) => ({
    profile: {
      ...profile,
      college: text(values.college),
      degree: values.degree,
      branch: text(values.branch),
      graduationYear: Number(values.graduationYear),
      cgpa: Math.round(Number(values.cgpa) * 100) / 100,
      education: values.education.map((entry) => ({
        level: text(entry.level),
        institute: text(entry.institute),
        year: Number(entry.year),
        score: text(entry.score),
      })),
    },
  }),
  [PROFILE_SECTIONS.SKILLS]: (values, profile) => ({
    profile: { ...profile, skills: values.skills.map(text) },
  }),
  [PROFILE_SECTIONS.PROJECTS]: (values, profile) => ({
    profile: {
      ...profile,
      projects: values.projects.map((entry) => ({
        title: text(entry.title),
        description: text(entry.description),
        link: text(entry.link),
      })),
      links: Object.fromEntries(PROFILE_LINK_FIELDS.map(({ name }) => [name, text(values.links?.[name])])),
    },
  }),
};

/**
 * Validate and save one Profile tab for the logged-in student.
 * @param {string} section one of PROFILE_SECTIONS
 * @param {object} values the tab's form values
 * @returns {{ ok: true, data: object }
 *   | { ok: false, code: string, error: string, fieldErrors?: Object<string, string> }} data = updated user
 */
export function updateProfileSection(section, values = {}) {
  const student = getStudent();
  if (!student) return failure(PROFILE_ERRORS.NOT_ALLOWED, 'Please log in as a student to edit your profile.');

  const build = SECTION_BUILDERS[section];
  if (!build) return failure(PROFILE_ERRORS.INVALID_SECTION, 'This part of the profile cannot be edited.');

  const fieldErrors = validateProfileSection(section, values);
  if (Object.keys(fieldErrors).length > 0) {
    return failure(PROFILE_ERRORS.VALIDATION_FAILED, 'Please correct the highlighted fields.', { fieldErrors });
  }

  const saved = updateStudentRecord(student.id, build(values, student.profile ?? {}));
  return saved.ok ? { ok: true, data: saved.data } : failure(PROFILE_ERRORS.STORAGE_ERROR, saved.error);
}

/* ==========================================================================
   Resume (PDF ≤ 500 KB stored as Base64 in profile.resume — PROJECT_SPEC.md §3.2, §5.1)
   ========================================================================== */

/** "12.3 KB" style size for messages and the resume card. */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  const kilobytes = bytes / 1024;
  return kilobytes < 1024 ? `${Number(kilobytes.toFixed(1))} KB` : `${Number((kilobytes / 1024).toFixed(1))} MB`;
}

/**
 * Check a chosen file before reading it.
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

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function saveResume(student, resume) {
  const saved = updateStudentRecord(student.id, { profile: { ...student.profile, resume } });
  return saved.ok ? { ok: true, data: saved.data } : failure(PROFILE_ERRORS.STORAGE_ERROR, saved.error);
}

/**
 * Upload or replace the logged-in student's resume. If anything fails (invalid file, full storage)
 * the previous resume is kept, because nothing is written until the new one is ready.
 * @param {File} file
 * @returns {Promise<{ ok: true, data: object } | { ok: false, code: string, error: string }>}
 */
export async function uploadResume(file) {
  const student = getStudent();
  if (!student) return failure(PROFILE_ERRORS.NOT_ALLOWED, 'Please log in as a student to upload a resume.');

  const message = validateResumeFile(file);
  if (message) return failure(PROFILE_ERRORS.INVALID_FILE, message);

  let dataUrl;
  try {
    dataUrl = await readAsDataUrl(file);
  } catch {
    return failure(PROFILE_ERRORS.INVALID_FILE, 'This file could not be read. Please try another PDF.');
  }
  if (!dataUrl.startsWith(PDF_DATA_URL_PREFIX)) {
    return failure(PROFILE_ERRORS.INVALID_FILE, 'This file could not be read as a PDF. Please try another file.');
  }

  // Re-check the session: it may have changed while the file was being read.
  const current = getStudent();
  if (!current || current.id !== student.id) {
    return failure(PROFILE_ERRORS.NOT_ALLOWED, 'Your session changed. Please log in again.');
  }
  return saveResume(current, {
    fileName: text(file.name) || 'resume.pdf',
    dataUrl,
    uploadedAt: new Date().toISOString(),
  });
}

/**
 * Remove the logged-in student's resume. Past applications keep their recorded file name (BR-17).
 * @returns {{ ok: true, data: object } | { ok: false, code: string, error: string }}
 */
export function removeResume() {
  const student = getStudent();
  if (!student) return failure(PROFILE_ERRORS.NOT_ALLOWED, 'Please log in as a student to manage your resume.');
  if (!student.profile?.resume) return failure(PROFILE_ERRORS.NO_RESUME, 'There is no resume to remove.');
  return saveResume(student, null);
}

function isStoredResumeValid(resume) {
  return typeof resume?.fileName === 'string'
    && typeof resume.dataUrl === 'string'
    && resume.dataUrl.startsWith(PDF_DATA_URL_PREFIX);
}

/**
 * Display details of a student's stored resume (never the file itself).
 * @param {object} user
 * @returns {null | { fileName: string, fileType: string, sizeBytes: number, uploadedAt: string, isCorrupted: boolean }}
 */
export function getResumeInfo(user) {
  const resume = user?.profile?.resume;
  if (!resume) return null;
  if (!isStoredResumeValid(resume)) {
    const fileName = typeof resume.fileName === 'string' && resume.fileName ? resume.fileName : 'Unknown file';
    return { fileName, fileType: 'PDF', sizeBytes: 0, uploadedAt: '', isCorrupted: true };
  }
  const base64 = resume.dataUrl.slice(PDF_DATA_URL_PREFIX.length);
  const padding = (base64.match(/=+$/)?.[0].length) ?? 0;
  return {
    fileName: resume.fileName,
    fileType: 'PDF',
    sizeBytes: Math.floor((base64.length * 3) / 4) - padding,
    uploadedAt: typeof resume.uploadedAt === 'string' ? resume.uploadedAt : '',
    isCorrupted: false,
  };
}

/**
 * The logged-in student's own resume as a PDF Blob, for viewing or downloading in this browser.
 * @returns {{ ok: true, data: { blob: Blob, fileName: string } } | { ok: false, code: string, error: string }}
 */
export function getOwnResumeFile() {
  const student = getStudent();
  if (!student) return failure(PROFILE_ERRORS.NOT_ALLOWED, 'Please log in as a student to open your resume.');
  const resume = student.profile?.resume;
  if (!resume) return failure(PROFILE_ERRORS.NO_RESUME, 'You have not uploaded a resume yet.');

  return decodeResumeFile(resume, 'Your saved resume file is damaged and cannot be opened. Please upload it again.');
}

/**
 * Turn a stored `profile.resume` into a PDF Blob. Callers must have checked who may open it
 * (the student themself, or — in application-service — the recruiter of a job they applied to).
 * @param {object} resume
 * @param {string} [damagedMessage]
 * @returns {{ ok: true, data: { blob: Blob, fileName: string } } | { ok: false, code: string, error: string }}
 */
export function decodeResumeFile(resume, damagedMessage = 'This resume file is damaged and cannot be opened.') {
  const corrupted = failure(PROFILE_ERRORS.CORRUPTED_RESUME, damagedMessage);
  if (!isStoredResumeValid(resume)) return corrupted;
  try {
    const binary = atob(resume.dataUrl.slice(PDF_DATA_URL_PREFIX.length));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return { ok: true, data: { blob: new Blob([bytes], { type: RESUME_MIME_TYPE }), fileName: resume.fileName } };
  } catch {
    return corrupted;
  }
}

/* ==========================================================================
   Recruiter company profile (Phase 8) — PROJECT_SPEC.md §5.1 "Recruiter profile"
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
 * Save the logged-in recruiter's contact and company details. Pending recruiters may do this too
 * (it does not post anything); id, role, email, password, status and createdAt never change.
 * @param {object} values form values
 * @returns {{ ok: true, data: object }
 *   | { ok: false, code: string, error: string, fieldErrors?: Object<string, string> }} data = updated user
 */
export function updateCompanyProfile(values = {}) {
  const recruiter = getCurrentUser();
  if (recruiter?.role !== ROLES.RECRUITER) {
    return failure(PROFILE_ERRORS.NOT_ALLOWED, 'Please log in as a recruiter to edit the company profile.');
  }

  const fieldErrors = COMPANY_PROFILE_FIELDS.reduce((errors, field) => {
    const message = validateCompanyField(field, values[field]);
    return message ? { ...errors, [field]: message } : errors;
  }, {});
  if (Object.keys(fieldErrors).length > 0) {
    return failure(PROFILE_ERRORS.VALIDATION_FAILED, 'Please correct the highlighted fields.', { fieldErrors });
  }

  const profileFields = COMPANY_PROFILE_FIELDS.filter((field) => field !== 'name' && field !== 'phone');
  const saved = updateRecruiterRecord(recruiter.id, {
    name: text(values.name),
    phone: text(values.phone),
    profile: {
      ...(recruiter.profile ?? {}),
      ...Object.fromEntries(profileFields.map((field) => [field, text(values[field])])),
    },
  });
  return saved.ok ? { ok: true, data: saved.data } : failure(PROFILE_ERRORS.STORAGE_ERROR, saved.error);
}
