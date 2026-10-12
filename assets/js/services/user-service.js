/**
 * user-service.js — Account rules the forms use: registration field checks and small helpers
 * about a user. These checks give quick feedback while typing; the API runs the same rules again
 * (and the ones only it can check, such as whether an email is already registered) and is the
 * one that decides.
 */

import {
  ROLES, PUBLIC_REGISTRATION_ROLES, DEGREE_OPTIONS, GRADUATION_YEAR_OPTIONS, CGPA_MAX,
} from '../core/config.js';
import { isValidEmail, isStrongPassword } from '../core/utils.js';

/**
 * How complete a student's profile is (15 equally weighted items, PROJECT_SPEC.md §3.2).
 * The server calculates it and sends it with the user.
 * @param {object} user student as returned by the API
 * @returns {{ percent: number, missing: string[] }} percent 0–100; labels of missing items
 */
export function getProfileCompleteness(user) {
  const completeness = user?.completeness;
  return {
    percent: Number.isFinite(completeness?.percent) ? completeness.percent : 0,
    missing: Array.isArray(completeness?.missing) ? completeness.missing : [],
  };
}

/* ==========================================================================
   Registration form rules
   ========================================================================== */

/** Fields collected at registration (UI_SPEC.md §5 "Register"). */
export const REGISTRATION_FIELDS = Object.freeze({
  common: ['name', 'email', 'phone', 'password', 'confirmPassword'],
  [ROLES.STUDENT]: ['college', 'degree', 'branch', 'graduationYear', 'cgpa'],
  [ROLES.RECRUITER]: ['companyName', 'designation', 'companyWebsite', 'companyLocation'],
});

const text = (value) => String(value ?? '').trim();
const required = (label) => (value) => (text(value) ? '' : `Please enter ${label}.`);

/** http(s) URLs only, so a stored link can never run script (e.g. "javascript:"). */
export function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

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
    GRADUATION_YEAR_OPTIONS.includes(Number(value)) ? '' : 'Please select your graduation year.'
  ),
  cgpa: (value) => {
    if (!text(value)) return 'Please enter your CGPA.';
    const cgpa = Number(value);
    return Number.isFinite(cgpa) && cgpa >= 0 && cgpa <= CGPA_MAX
      ? ''
      : `CGPA must be a number between 0 and ${CGPA_MAX}.`;
  },
  companyName: required('your company name'),
  designation: required('your designation'),
  companyWebsite: (value) => (
    !text(value) || isValidUrl(text(value)) ? '' : 'Please enter a valid website, e.g. https://example.com.'
  ),
  companyLocation: required('your company location'),
};

/** Fields that apply to a role; empty for roles that cannot self-register. */
export function getRegistrationFields(role) {
  if (!PUBLIC_REGISTRATION_ROLES.includes(role)) return [];
  return [...REGISTRATION_FIELDS.common, ...REGISTRATION_FIELDS[role]];
}

/**
 * Validate one registration field.
 * @param {string} field
 * @param {object} values all current form values (needed for confirmPassword)
 * @returns {string} error message, or '' when valid
 */
export function validateRegistrationField(field, values) {
  const rule = FIELD_RULES[field];
  return rule ? rule(values[field], values) : '';
}

/**
 * Validate every field for the chosen role.
 * @returns {Object<string, string>} field → message for invalid fields only (empty object = valid)
 */
export function validateRegistration(values) {
  return getRegistrationFields(values.role).reduce((errors, field) => {
    const message = validateRegistrationField(field, values);
    return message ? { ...errors, [field]: message } : errors;
  }, {});
}
