/**
 * job-validator.js — Job posting rules (PROJECT_SPEC.md §3.3 "Job posting rules") and the
 * job search query. `validateJobForm` returns field messages; `buildJobFields` returns the
 * normalised, whitelisted fields a recruiter controls — owner, company and status are never
 * taken from the request.
 */

const {
  JOB_TYPES, WORK_MODES, SALARY_PERIODS, DEGREE_OPTIONS, CGPA_MAX, JOB_LIMITS, PAY_RANGES, JOB_SORTS, LIMITS,
} = require('../config/constants');
const { text, isBlank, list } = require('../utils/text');
const { isValidDateKey, todayKey, currentYear } = require('../utils/dates');

const GRADUATION_YEAR_SPAN = 10;

const tooLong = (label, limit) => (value) => (
  text(value).length > limit ? `${label} must be ${limit} characters or fewer.` : ''
);
const required = (label, limit, message) => (value) => (isBlank(value) ? message : tooLong(label, limit)(value));
const wholeNumber = (value) => (/^\d+$/.test(text(value)) ? Number(text(value)) : NaN);

/** Can this skill be added to a job's list? */
function validateJobSkill(skill, skills = []) {
  const value = text(skill);
  if (!value) return 'Please type a skill to add.';
  if (value.length > JOB_LIMITS.SKILL) return `A skill must be ${JOB_LIMITS.SKILL} characters or fewer.`;
  if (skills.some((existing) => text(existing).toLowerCase() === value.toLowerCase())) {
    return `"${value}" is already in the list.`;
  }
  if (skills.length >= JOB_LIMITS.MAX_SKILLS) return `You can add up to ${JOB_LIMITS.MAX_SKILLS} skills.`;
  return '';
}

/** One rule per form field: (value, allValues) → message ('' when valid). */
const JOB_FIELD_RULES = {
  title: required('Job title', JOB_LIMITS.TITLE, 'Please enter the job title.'),
  location: required('Location', JOB_LIMITS.LOCATION, 'Please enter the job location.'),
  jobType: (value) => (Object.values(JOB_TYPES).includes(value) ? '' : 'Please choose a job type.'),
  workMode: (value) => (Object.values(WORK_MODES).includes(value) ? '' : 'Please choose a work mode.'),
  experience: required('Experience', JOB_LIMITS.EXPERIENCE, 'Please enter the experience needed, e.g. Fresher.'),
  openings: (value) => {
    const openings = wholeNumber(value);
    return openings >= 1 && openings <= JOB_LIMITS.MAX_OPENINGS
      ? '' : `Please enter the number of openings (1 to ${JOB_LIMITS.MAX_OPENINGS}).`;
  },
  deadline: (value) => {
    if (isBlank(value)) return 'Please choose an application deadline.';
    if (!isValidDateKey(text(value))) return 'Please enter a valid date.';
    return text(value) < todayKey() ? 'The deadline must be today or a later date.' : '';
  },
  salaryPeriod: (value, values) => {
    if (!Object.values(SALARY_PERIODS).includes(value)) return 'Please choose how the pay is counted.';
    return values.jobType === JOB_TYPES.INTERNSHIP && value !== SALARY_PERIODS.MONTH
      ? 'Internships pay a monthly stipend. Please choose "per month".' : '';
  },
  salaryMin: (value, values) => {
    if (isBlank(value) && isBlank(values.salaryMax)) return ''; // pay not disclosed
    const amount = wholeNumber(value);
    return amount >= 1 && amount <= JOB_LIMITS.MAX_SALARY
      ? '' : 'Please enter the minimum pay in rupees (whole number), or leave both amounts empty.';
  },
  salaryMax: (value, values) => {
    if (isBlank(value)) return '';
    const amount = wholeNumber(value);
    if (!(amount >= 1 && amount <= JOB_LIMITS.MAX_SALARY)) return 'Please enter the maximum pay in rupees (whole number).';
    const min = wholeNumber(values.salaryMin);
    return Number.isNaN(min) || amount >= min ? '' : 'The maximum must be at least the minimum.';
  },
  description: required('Description', JOB_LIMITS.DESCRIPTION, 'Please describe the job.'),
  responsibilities: (value) => {
    const items = list(value).map(text).filter(Boolean);
    if (items.length > JOB_LIMITS.MAX_RESPONSIBILITIES) {
      return `Please list up to ${JOB_LIMITS.MAX_RESPONSIBILITIES} responsibilities.`;
    }
    return items.some((item) => item.length > JOB_LIMITS.RESPONSIBILITY)
      ? `Each responsibility must be ${JOB_LIMITS.RESPONSIBILITY} characters or fewer.` : '';
  },
  skills: (value) => {
    const skills = list(value);
    if (skills.length === 0) return 'Please add at least one skill.';
    const accepted = [];
    for (const skill of skills) {
      const message = validateJobSkill(skill, accepted);
      if (message) return message;
      accepted.push(text(skill));
    }
    return '';
  },
  degrees: (value) => (list(value).every((degree) => DEGREE_OPTIONS.includes(degree))
    ? '' : 'Please choose degrees from the list.'),
  graduationYears: (value) => {
    const year = currentYear();
    return list(value).every((item) => {
      const number = Number(text(item));
      return Number.isInteger(number) && number >= year - GRADUATION_YEAR_SPAN && number <= year + GRADUATION_YEAR_SPAN;
    }) ? '' : 'Please choose graduation years from the list.';
  },
  minCgpa: (value) => {
    if (isBlank(value)) return '';
    const cgpa = Number(text(value));
    return Number.isFinite(cgpa) && cgpa >= 0 && cgpa <= CGPA_MAX ? '' : `Minimum CGPA must be between 0 and ${CGPA_MAX}.`;
  },
};

/** @returns {Object<string, string>} field → message for invalid fields only */
function validateJobForm(values = {}) {
  return Object.keys(JOB_FIELD_RULES).reduce((errors, field) => {
    const message = JOB_FIELD_RULES[field](values[field], values);
    return message ? { ...errors, [field]: message } : errors;
  }, {});
}

/** The job fields a recruiter controls, normalised (call after validateJobForm passed). */
function buildJobFields(values) {
  const hasPay = !isBlank(values.salaryMin);
  const salaryMin = hasPay ? wholeNumber(values.salaryMin) : 0;
  return {
    title: text(values.title),
    location: text(values.location),
    jobType: values.jobType,
    workMode: values.workMode,
    salaryMin,
    salaryMax: hasPay ? (isBlank(values.salaryMax) ? salaryMin : wholeNumber(values.salaryMax)) : 0,
    salaryPeriod: values.salaryPeriod,
    experience: text(values.experience),
    skills: list(values.skills).map(text),
    description: text(values.description),
    responsibilities: list(values.responsibilities).map(text).filter(Boolean),
    eligibility: {
      degrees: DEGREE_OPTIONS.filter((degree) => list(values.degrees).includes(degree)),
      graduationYears: [...new Set(list(values.graduationYears).map((year) => Number(text(year))))].sort((a, b) => a - b),
      minCgpa: isBlank(values.minCgpa) ? null : Math.round(Number(text(values.minCgpa)) * 100) / 100,
    },
    openings: wholeNumber(values.openings),
    deadline: text(values.deadline),
  };
}

const pick = (value, allowed) => (allowed.includes(value) ? value : '');
const MAX_FILTER_SKILLS = 20;

/**
 * Read the job search query string. Only known, plain-text criteria are kept; anything else
 * (unknown sort, made-up job type, nested objects) is ignored rather than passed to MongoDB.
 */
function parseJobSearch(query = {}) {
  const skills = text(query.skills).split(',').map(text).filter(Boolean).slice(0, MAX_FILTER_SKILLS);
  return {
    query: text(query.query).slice(0, LIMITS.SEARCH_QUERY),
    location: text(query.location).slice(0, JOB_LIMITS.LOCATION),
    jobType: pick(text(query.jobType), Object.values(JOB_TYPES)),
    workMode: pick(text(query.workMode), Object.values(WORK_MODES)),
    payRange: pick(text(query.payRange), PAY_RANGES.map((range) => range.value)),
    skills: skills.map((skill) => skill.slice(0, JOB_LIMITS.SKILL)),
    includeExpired: text(query.includeExpired) === 'true',
    sort: pick(text(query.sort), JOB_SORTS) || JOB_SORTS[0],
  };
}

module.exports = { validateJobForm, buildJobFields, parseJobSearch };
