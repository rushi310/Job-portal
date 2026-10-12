/**
 * profile-validator.js — Student profile sections, the recruiter company profile and resume
 * files (PROJECT_SPEC.md §3.2 "Profile rules", §3.3 "Company profile").
 * Each `build…` function copies only whitelisted fields, so id, role, email, password and status
 * can never be changed through a profile request.
 */

const {
  PROFILE_LIMITS, COMPANY_SIZE_OPTIONS, LIMITS, RESUME_MIME_TYPE,
} = require('../config/constants');
const { text } = require('../utils/text');
const { currentYear } = require('../utils/dates');
const { validateAccountField, isValidUrl } = require('./auth-validator');

const PROFILE_SECTIONS = Object.freeze(['personal', 'education', 'skills', 'projects']);
const LINK_FIELDS = Object.freeze([['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['portfolio', 'Portfolio']]);
const MAX_EDUCATION_YEAR_AHEAD = 5; // allows courses that are still in progress
const MAX_URL_LENGTH = 300;

const firstError = (...messages) => messages.find(Boolean) ?? '';
const tooLong = (label, limit) => (value) => (
  text(value).length > limit ? `${label} must be ${limit} characters or fewer.` : ''
);
const requiredText = (label, limit, message) => (value) => (text(value) ? tooLong(label, limit)(value) : message);
/** Registration's rule for the same field (same messages as sign-up). */
const accountRule = (field) => (value) => validateAccountField(field, { [field]: value });
const optionalUrl = (label) => (value) => {
  if (!text(value)) return '';
  if (!isValidUrl(text(value))) return `Please enter a valid ${label} link starting with https:// (or http://).`;
  return tooLong('Link', MAX_URL_LENGTH)(value);
};

/** Repeated entries use "section.field" keys; their errors are reported as "section.<index>.field". */
const FIELD_RULES = {
  name: (value) => firstError(accountRule('name')(value), tooLong('Full name', PROFILE_LIMITS.SHORT_TEXT)(value)),
  phone: accountRule('phone'),
  location: tooLong('Location', PROFILE_LIMITS.SHORT_TEXT),
  about: tooLong('About you', PROFILE_LIMITS.ABOUT),
  college: (value) => firstError(accountRule('college')(value), tooLong('College', PROFILE_LIMITS.SHORT_TEXT)(value)),
  degree: accountRule('degree'),
  branch: (value) => firstError(accountRule('branch')(value), tooLong('Branch', PROFILE_LIMITS.SHORT_TEXT)(value)),
  graduationYear: accountRule('graduationYear'),
  cgpa: accountRule('cgpa'),
  'education.level': requiredText('Level', PROFILE_LIMITS.LEVEL, 'Please enter the level, e.g. HSC or Diploma.'),
  'education.institute': requiredText('Institute', PROFILE_LIMITS.SHORT_TEXT, 'Please enter the school or institute.'),
  'education.year': (value) => {
    if (!text(value)) return 'Please enter the year of passing.';
    const year = Number(text(value));
    const maxYear = currentYear() + MAX_EDUCATION_YEAR_AHEAD;
    return Number.isInteger(year) && year >= PROFILE_LIMITS.MIN_EDUCATION_YEAR && year <= maxYear
      ? '' : `Please enter a year between ${PROFILE_LIMITS.MIN_EDUCATION_YEAR} and ${maxYear}.`;
  },
  'education.score': tooLong('Score', PROFILE_LIMITS.SCORE),
  'projects.title': requiredText('Project title', PROFILE_LIMITS.SHORT_TEXT, 'Please enter the project title.'),
  'projects.description': tooLong('Description', PROFILE_LIMITS.PROJECT_DESCRIPTION),
  'projects.link': optionalUrl('project'),
  ...Object.fromEntries(LINK_FIELDS.map(([name, label]) => [`links.${name}`, optionalUrl(label)])),
};

const check = (field, value) => FIELD_RULES[field](value);

function collectFieldErrors(fields, values) {
  return fields.reduce((errors, field) => {
    const message = check(field, values[field]);
    return message ? { ...errors, [field]: message } : errors;
  }, {});
}

function collectEntryErrors(section, fields, entries, maxCount, noun) {
  if (!Array.isArray(entries)) return { [section]: `Please check your ${noun} entries.` };
  if (entries.length > maxCount) return { [section]: `You can add up to ${maxCount} ${noun} entries.` };
  return entries.reduce((errors, entry, index) => {
    fields.forEach((field) => {
      const message = check(`${section}.${field}`, entry?.[field]);
      if (message) errors[`${section}.${index}.${field}`] = message;
    });
    return errors;
  }, {});
}

function collectSkillErrors(skills) {
  if (!Array.isArray(skills)) return { skills: 'Please check your skills.' };
  if (skills.length > PROFILE_LIMITS.MAX_SKILLS) return { skills: `You can add up to ${PROFILE_LIMITS.MAX_SKILLS} skills.` };
  const accepted = [];
  for (const skill of skills) {
    const value = text(skill);
    if (!value) return { skills: 'Please type a skill to add.' };
    if (value.length > PROFILE_LIMITS.SKILL) return { skills: `A skill must be ${PROFILE_LIMITS.SKILL} characters or fewer.` };
    if (accepted.includes(value.toLowerCase())) return { skills: `"${value}" is already in your skills.` };
    accepted.push(value.toLowerCase());
  }
  return {};
}

const SECTION_VALIDATORS = {
  personal: (values) => collectFieldErrors(['name', 'phone', 'location', 'about'], values),
  education: (values) => ({
    ...collectFieldErrors(['college', 'degree', 'branch', 'graduationYear', 'cgpa'], values),
    ...collectEntryErrors('education', ['level', 'institute', 'year', 'score'], values.education,
      PROFILE_LIMITS.MAX_EDUCATION, 'education'),
  }),
  skills: (values) => collectSkillErrors(values.skills),
  projects: (values) => ({
    ...collectEntryErrors('projects', ['title', 'description', 'link'], values.projects,
      PROFILE_LIMITS.MAX_PROJECTS, 'project'),
    ...collectFieldErrors(
      LINK_FIELDS.map(([name]) => `links.${name}`),
      Object.fromEntries(LINK_FIELDS.map(([name]) => [`links.${name}`, values.links?.[name]])),
    ),
  }),
};

/** @returns {Object<string, string>} field key → message (empty = valid) */
function validateProfileSection(section, values = {}) {
  return SECTION_VALIDATORS[section](values);
}

/**
 * The database changes for one profile section, as a `$set` map of whitelisted paths only.
 * Call after validateProfileSection passed.
 */
const SECTION_BUILDERS = {
  personal: (values) => ({
    name: text(values.name),
    phone: text(values.phone),
    'studentProfile.location': text(values.location),
    'studentProfile.about': text(values.about),
  }),
  education: (values) => ({
    'studentProfile.college': text(values.college),
    'studentProfile.degree': values.degree,
    'studentProfile.branch': text(values.branch),
    'studentProfile.graduationYear': Number(text(values.graduationYear)),
    'studentProfile.cgpa': Math.round(Number(text(values.cgpa)) * 100) / 100,
    'studentProfile.education': values.education.map((entry) => ({
      level: text(entry.level),
      institute: text(entry.institute),
      year: Number(text(entry.year)),
      score: text(entry.score),
    })),
  }),
  skills: (values) => ({ 'studentProfile.skills': values.skills.map(text) }),
  projects: (values) => ({
    'studentProfile.projects': values.projects.map((entry) => ({
      title: text(entry.title),
      description: text(entry.description),
      link: text(entry.link),
    })),
    'studentProfile.links': Object.fromEntries(LINK_FIELDS.map(([name]) => [name, text(values.links?.[name])])),
  }),
};

const buildProfileSection = (section, values) => SECTION_BUILDERS[section](values);

/* ---------- Recruiter company profile ---------- */

const COMPANY_PROFILE_FIELDS = Object.freeze([
  'companyName', 'designation', 'companyWebsite', 'companyLocation', 'companySize', 'industry', 'about',
]);

const COMPANY_FIELD_RULES = {
  name: FIELD_RULES.name,
  phone: FIELD_RULES.phone,
  companyName: (value) => firstError(accountRule('companyName')(value), tooLong('Company name', PROFILE_LIMITS.SHORT_TEXT)(value)),
  designation: (value) => firstError(accountRule('designation')(value), tooLong('Designation', PROFILE_LIMITS.SHORT_TEXT)(value)),
  companyWebsite: accountRule('companyWebsite'),
  companyLocation: (value) => firstError(accountRule('companyLocation')(value), tooLong('Company location', PROFILE_LIMITS.SHORT_TEXT)(value)),
  companySize: (value) => (!text(value) || COMPANY_SIZE_OPTIONS.includes(value) ? '' : 'Please choose a company size from the list.'),
  industry: tooLong('Industry', PROFILE_LIMITS.SHORT_TEXT),
  about: tooLong('About the company', PROFILE_LIMITS.ABOUT),
};

function validateCompanyProfile(values = {}) {
  return Object.keys(COMPANY_FIELD_RULES).reduce((errors, field) => {
    const message = COMPANY_FIELD_RULES[field](values[field]);
    return message ? { ...errors, [field]: message } : errors;
  }, {});
}

function buildCompanyProfile(values) {
  return {
    name: text(values.name),
    phone: text(values.phone),
    ...Object.fromEntries(COMPANY_PROFILE_FIELDS.map((field) => [`recruiterProfile.${field}`, text(values[field])])),
  };
}

/* ---------- Resume ---------- */

const PDF_SIGNATURE = Buffer.from('%PDF-');
const MAX_FILE_NAME_LENGTH = 120;

/**
 * Check an uploaded resume. The declared type and the file name are not trusted on their own:
 * the content must start with the PDF signature, and the size is measured from the bytes received.
 * @param {Buffer} data
 * @param {string} contentType the request's Content-Type
 * @returns {string} error message, or '' when the file is acceptable
 */
function validateResumeUpload(data, contentType) {
  if (text(contentType).split(';')[0].trim().toLowerCase() !== RESUME_MIME_TYPE) {
    return 'Only PDF files can be uploaded. Please choose a .pdf file.';
  }
  if (!Buffer.isBuffer(data) || data.length === 0) return 'This file is empty. Please choose another PDF.';
  if (data.length > LIMITS.MAX_RESUME_SIZE) return 'This file is too large. The maximum size is 500 KB.';
  if (!data.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    return 'This file is not a valid PDF. Please choose another file.';
  }
  return '';
}

/**
 * A display-safe file name: no folders, no control characters, always ending in ".pdf".
 * The name is only ever shown as text and used as a download name.
 */
function sanitizeFileName(rawName) {
  let name = text(rawName);
  try {
    name = decodeURIComponent(name);
  } catch {
    // keep the undecoded name
  }
  name = name.split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '').trim().slice(0, MAX_FILE_NAME_LENGTH);
  if (!name || name === '.pdf') return 'resume.pdf';
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

module.exports = {
  PROFILE_SECTIONS,
  validateProfileSection,
  buildProfileSection,
  validateCompanyProfile,
  buildCompanyProfile,
  validateResumeUpload,
  sanitizeFileName,
};
