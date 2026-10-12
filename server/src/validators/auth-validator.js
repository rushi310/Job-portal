/**
 * auth-validator.js — Registration and login input rules (BR-01, BR-02, BR-06;
 * PROJECT_SPEC.md §4.1 "Registration field formats"). Same messages as the registration form.
 */

const {
  ROLES, PUBLIC_REGISTRATION_ROLES, DEGREE_OPTIONS, CGPA_MAX, LIMITS, PROFILE_LIMITS,
} = require('../config/constants');
const { text, normalizeEmail } = require('../utils/text');
const { currentYear } = require('../utils/dates');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const MAX_EMAIL_LENGTH = 254;

const isValidEmail = (value) => EMAIL_PATTERN.test(text(value)) && text(value).length <= MAX_EMAIL_LENGTH;
const isStrongPassword = (value) => typeof value === 'string'
  && value.length <= LIMITS.PASSWORD_MAX && STRONG_PASSWORD_PATTERN.test(value);

/** http(s) URLs only, so a stored link can never run script (e.g. "javascript:"). */
function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Graduation years offered at registration: two years back to two years ahead. */
function getGraduationYearOptions() {
  const year = currentYear();
  return Array.from({ length: 5 }, (_, index) => year - 2 + index);
}

const tooLong = (label, limit) => (value) => (
  text(value).length > limit ? `${label} must be ${limit} characters or fewer.` : ''
);
const required = (label, limit = PROFILE_LIMITS.SHORT_TEXT) => (value) => (
  text(value) ? tooLong('This field', limit)(value) : `Please enter ${label}.`
);

/** One rule per field: (value, allValues) → error message ('' when valid). */
const FIELD_RULES = {
  name: required('your full name'),
  email: (value) => {
    if (!text(value)) return 'Please enter your email address.';
    return isValidEmail(value) ? '' : 'Please enter a valid email address, e.g. name@example.com.';
  },
  phone: (value) => {
    if (!text(value)) return 'Please enter your phone number.';
    return /^\d{10}$/.test(text(value)) ? '' : 'Please enter a 10-digit phone number.';
  },
  password: (value) => {
    if (!value) return 'Please create a password.';
    return isStrongPassword(value)
      ? ''
      : 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.';
  },
  confirmPassword: (value, values) => {
    if (!value) return 'Please confirm your password.';
    return value === values.password ? '' : 'Passwords do not match.';
  },
  college: required('your college name'),
  degree: (value) => (DEGREE_OPTIONS.includes(value) ? '' : 'Please select your degree.'),
  branch: required('your branch or specialisation'),
  graduationYear: (value) => (
    getGraduationYearOptions().includes(Number(text(value))) ? '' : 'Please select your graduation year.'
  ),
  cgpa: (value) => {
    if (!text(value)) return 'Please enter your CGPA.';
    const cgpa = Number(text(value));
    return Number.isFinite(cgpa) && cgpa >= 0 && cgpa <= CGPA_MAX
      ? ''
      : `CGPA must be a number between 0 and ${CGPA_MAX}.`;
  },
  companyName: required('your company name'),
  designation: required('your designation'),
  companyWebsite: (value) => {
    if (!text(value)) return '';
    if (!isValidUrl(text(value))) return 'Please enter a valid website, e.g. https://example.com.';
    return tooLong('Website', PROFILE_LIMITS.SHORT_TEXT * 2)(value);
  },
  companyLocation: required('your company location'),
};

const REGISTRATION_FIELDS = {
  common: ['name', 'email', 'phone', 'password', 'confirmPassword'],
  [ROLES.STUDENT]: ['college', 'degree', 'branch', 'graduationYear', 'cgpa'],
  [ROLES.RECRUITER]: ['companyName', 'designation', 'companyWebsite', 'companyLocation'],
};

/** Validate one registration-style field. @returns {string} message, or '' */
function validateAccountField(field, values) {
  const rule = FIELD_RULES[field];
  return rule ? rule(values[field], values) : '';
}

const isPublicRole = (role) => PUBLIC_REGISTRATION_ROLES.includes(role);

/**
 * Validate a registration request for the chosen role.
 * @returns {Object<string, string>} field → message (empty = valid)
 */
function validateRegistration(values) {
  const fields = [...REGISTRATION_FIELDS.common, ...REGISTRATION_FIELDS[values.role]];
  return fields.reduce((errors, field) => {
    const message = validateAccountField(field, values);
    return message ? { ...errors, [field]: message } : errors;
  }, {});
}

/** @returns {{ email: string, password: string }|null} null when either is missing or not text */
function readCredentials(body = {}) {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password || password.length > LIMITS.PASSWORD_MAX) return null;
  return { email, password };
}

module.exports = {
  isValidUrl, isPublicRole, getGraduationYearOptions, validateAccountField, validateRegistration, readCredentials,
};
