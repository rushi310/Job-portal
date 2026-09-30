/**
 * user-service.js — Business logic for user accounts.
 * Lookup, demo password check, login eligibility (P2-T01) and registration (P2-T03).
 */

import {
  STORAGE_KEYS, ROLES, USER_STATUS, PUBLIC_REGISTRATION_ROLES,
  DEGREE_OPTIONS, GRADUATION_YEAR_OPTIONS, CGPA_MAX,
} from '../core/config.js';
import { getLocal, setLocal } from '../core/storage.js';
import { generateId, isValidEmail, isStrongPassword } from '../core/utils.js';

/** Error codes returned in `{ ok: false, code, error }` results. */
export const ACCOUNT_ERRORS = Object.freeze({
  BLOCKED: 'ACCOUNT_BLOCKED',
  INACTIVE: 'ACCOUNT_INACTIVE',
  INVALID_ROLE: 'INVALID_ROLE',
});

/** @returns {Array<object>} every stored user (including passwords — never return these to pages) */
function getAllUsers() {
  return getLocal(STORAGE_KEYS.USERS, []);
}

/** Emails are compared case-insensitively and without surrounding spaces (BR-01). */
export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

/** @returns {boolean} true for 'student', 'recruiter', or 'admin' */
export function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

/** @returns {object|null} raw user record, or null if not found */
export function findUserByEmail(email) {
  const target = normalizeEmail(email);
  if (!target) return null;
  return getAllUsers().find((user) => normalizeEmail(user.email) === target) ?? null;
}

/** @returns {object|null} raw user record, or null if not found */
export function findUserById(userId) {
  if (!userId) return null;
  return getAllUsers().find((user) => user.id === userId) ?? null;
}

/**
 * Demo-only password check: plain-text comparison (PROJECT_SPEC.md §8, CLAUDE.md §6).
 * @returns {boolean}
 */
export function isPasswordMatch(user, password) {
  return typeof password === 'string' && password.length > 0 && user.password === password;
}

/**
 * Copy of a user without the password, safe to hand to pages.
 * @returns {object|null}
 */
export function toPublicUser(user) {
  if (!user) return null;
  const { password, ...publicUser } = user;
  return publicUser;
}

/**
 * Can this account log in? (PROJECT_SPEC.md §2, BR-03, BR-07)
 * - active → yes
 * - pending recruiter → yes, with limited access until an admin approves
 * - blocked → no
 * - any other status/role combination → no
 * @returns {{ ok: true, isPendingApproval: boolean } | { ok: false, code: string, error: string }}
 */
export function checkLoginEligibility(user) {
  if (!isValidRole(user.role)) {
    return { ok: false, code: ACCOUNT_ERRORS.INVALID_ROLE, error: 'This account has an unknown role.' };
  }
  if (user.status === USER_STATUS.ACTIVE) {
    return { ok: true, isPendingApproval: false };
  }
  if (user.status === USER_STATUS.PENDING && user.role === ROLES.RECRUITER) {
    return { ok: true, isPendingApproval: true };
  }
  if (user.status === USER_STATUS.BLOCKED) {
    return {
      ok: false,
      code: ACCOUNT_ERRORS.BLOCKED,
      error: 'This account has been blocked. Please contact the FreshHire admin.',
    };
  }
  return { ok: false, code: ACCOUNT_ERRORS.INACTIVE, error: 'This account is not active.' };
}

/** True when a recruiter is still waiting for admin approval. */
export function isPendingRecruiter(user) {
  return user?.role === ROLES.RECRUITER && user.status === USER_STATUS.PENDING;
}

/* ==========================================================================
   Profile completeness (Phase 3)
   ========================================================================== */

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const hasItems = (value) => Array.isArray(value) && value.length > 0;

/**
 * The 15 equally weighted items of a complete student profile (PROJECT_SPEC.md §5.1).
 * Registration fills the first 8; the rest are completed in Phase 7 (Profile & Resume).
 */
const PROFILE_CHECKS = [
  { label: 'Full name', isDone: (user) => hasText(user.name) },
  { label: 'Email', isDone: (user) => hasText(user.email) },
  { label: 'Phone', isDone: (user) => hasText(user.phone) },
  { label: 'College', isDone: (user, profile) => hasText(profile.college) },
  { label: 'Degree', isDone: (user, profile) => hasText(profile.degree) },
  { label: 'Branch', isDone: (user, profile) => hasText(profile.branch) },
  { label: 'Graduation year', isDone: (user, profile) => Number.isFinite(profile.graduationYear) },
  { label: 'CGPA', isDone: (user, profile) => Number.isFinite(profile.cgpa) },
  { label: 'Location', isDone: (user, profile) => hasText(profile.location) },
  { label: 'About you', isDone: (user, profile) => hasText(profile.about) },
  { label: 'Skills', isDone: (user, profile) => hasItems(profile.skills) },
  { label: 'Education', isDone: (user, profile) => hasItems(profile.education) },
  { label: 'Projects', isDone: (user, profile) => hasItems(profile.projects) },
  { label: 'Profile links', isDone: (user, profile) => Object.values(profile.links ?? {}).some(hasText) },
  { label: 'Resume', isDone: (user, profile) => Boolean(profile.resume) },
];

/**
 * How complete a student's profile is.
 * @param {object} user student (public user object is fine)
 * @returns {{ percent: number, missing: string[] }} percent 0–100 (rounded); labels of missing items
 */
export function getProfileCompleteness(user) {
  const profile = user?.profile ?? {};
  const missing = PROFILE_CHECKS
    .filter((check) => !check.isDone(user ?? {}, profile))
    .map((check) => check.label);
  const percent = Math.round(((PROFILE_CHECKS.length - missing.length) / PROFILE_CHECKS.length) * 100);
  return { percent, missing };
}

/* ==========================================================================
   Registration (P2-T03)
   ========================================================================== */

/** BR-01 */
export function isEmailTaken(email) {
  return findUserByEmail(email) !== null;
}

/** Fields collected at registration (UI_SPEC.md §5 "Register"). */
export const REGISTRATION_FIELDS = Object.freeze({
  common: ['name', 'email', 'phone', 'password', 'confirmPassword'],
  [ROLES.STUDENT]: ['college', 'degree', 'branch', 'graduationYear', 'cgpa'],
  [ROLES.RECRUITER]: ['companyName', 'designation', 'companyWebsite', 'companyLocation'],
});

const text = (value) => String(value ?? '').trim();
const required = (label) => (value) => (text(value) ? '' : `Please enter ${label}.`);

function isValidUrl(value) {
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
    if (!isValidEmail(value)) return 'Please enter a valid email address, e.g. name@example.com.';
    if (isEmailTaken(value)) return 'An account with this email already exists. Please log in instead.';
    return '';
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

function buildStudentProfile(values) {
  return {
    college: text(values.college),
    degree: values.degree,
    branch: text(values.branch),
    graduationYear: Number(values.graduationYear),
    cgpa: Math.round(Number(values.cgpa) * 100) / 100,
    location: '',
    about: '',
    skills: [],
    education: [],
    projects: [],
    links: { linkedin: '', github: '', portfolio: '' },
    resume: null,
  };
}

function buildRecruiterProfile(values) {
  return {
    companyName: text(values.companyName),
    designation: text(values.designation),
    companyWebsite: text(values.companyWebsite),
    companyLocation: text(values.companyLocation),
    companySize: '',
    industry: '',
    about: '',
  };
}

/** Initial status (PROJECT_SPEC.md §2): students active, recruiters pending admin approval. */
const INITIAL_STATUS = {
  [ROLES.STUDENT]: USER_STATUS.ACTIVE,
  [ROLES.RECRUITER]: USER_STATUS.PENDING,
};

/**
 * Build and save a new user. Call only after validateRegistration() returned no errors.
 * @returns {{ ok: true, data: object } | { ok: false, error: string }} data = the new user (with password)
 */
export function createUser(values) {
  const isStudent = values.role === ROLES.STUDENT;
  const user = {
    id: generateId('usr'),
    role: values.role,
    name: text(values.name),
    email: normalizeEmail(values.email),
    password: values.password, // plain text: demo only (PROJECT_SPEC.md §8)
    phone: text(values.phone),
    status: INITIAL_STATUS[values.role],
    createdAt: new Date().toISOString(),
    profile: isStudent ? buildStudentProfile(values) : buildRecruiterProfile(values),
  };

  const saved = setLocal(STORAGE_KEYS.USERS, [...getAllUsers(), user]);
  return saved.ok ? { ok: true, data: user } : { ok: false, error: saved.error };
}
