/**
 * serializers.js — Turns database documents into the JSON shapes the frontend uses
 * (PROJECT_SPEC.md §5). Nothing leaves the API except through these functions, so password
 * hashes, token versions and internal fields are never sent.
 */

const { ROLES } = require('../config/constants');
const { isExpired } = require('./dates');

const id = (value) => (value ? String(value._id ?? value) : null);
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const hasItems = (value) => Array.isArray(value) && value.length > 0;

/** The 15 equally weighted items of a complete student profile (PROJECT_SPEC.md §3.2). */
const PROFILE_CHECKS = [
  ['Full name', (user) => hasText(user.name)],
  ['Email', (user) => hasText(user.email)],
  ['Phone', (user) => hasText(user.phone)],
  ['College', (user, profile) => hasText(profile.college)],
  ['Degree', (user, profile) => hasText(profile.degree)],
  ['Branch', (user, profile) => hasText(profile.branch)],
  ['Graduation year', (user, profile) => Number.isFinite(profile.graduationYear)],
  ['CGPA', (user, profile) => Number.isFinite(profile.cgpa)],
  ['Location', (user, profile) => hasText(profile.location)],
  ['About you', (user, profile) => hasText(profile.about)],
  ['Skills', (user, profile) => hasItems(profile.skills)],
  ['Education', (user, profile) => hasItems(profile.education)],
  ['Projects', (user, profile) => hasItems(profile.projects)],
  ['Profile links', (user, profile) => Object.values(profile.links ?? {}).some(hasText)],
  ['Resume', (user, profile) => Boolean(profile.resume)],
];

/** @returns {{ percent: number, missing: string[] }} */
function getProfileCompleteness(user, profile) {
  const missing = PROFILE_CHECKS.filter(([, isDone]) => !isDone(user, profile)).map(([label]) => label);
  return {
    percent: Math.round(((PROFILE_CHECKS.length - missing.length) / PROFILE_CHECKS.length) * 100),
    missing,
  };
}

function toStudentProfile(profile = {}) {
  return {
    college: profile.college ?? '',
    degree: profile.degree ?? '',
    branch: profile.branch ?? '',
    graduationYear: profile.graduationYear ?? null,
    cgpa: profile.cgpa ?? null,
    location: profile.location ?? '',
    about: profile.about ?? '',
    skills: [...(profile.skills ?? [])],
    education: (profile.education ?? []).map(({ level, institute, year, score }) => ({ level, institute, year, score })),
    projects: (profile.projects ?? []).map(({ title, description, link }) => ({ title, description, link })),
    links: {
      linkedin: profile.links?.linkedin ?? '',
      github: profile.links?.github ?? '',
      portfolio: profile.links?.portfolio ?? '',
    },
    resume: profile.resume
      ? { fileName: profile.resume.fileName, sizeBytes: profile.resume.sizeBytes, uploadedAt: profile.resume.uploadedAt }
      : null,
  };
}

function toRecruiterProfile(profile = {}) {
  const fields = ['companyName', 'designation', 'companyWebsite', 'companyLocation', 'companySize', 'industry', 'about'];
  return Object.fromEntries(fields.map((field) => [field, profile[field] ?? '']));
}

/** The logged-in user's own account (never the password hash). */
function toUser(user) {
  const base = {
    id: id(user),
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    status: user.status,
    createdAt: user.createdAt,
  };
  if (user.role === ROLES.STUDENT) {
    const profile = toStudentProfile(user.studentProfile ?? {});
    return { ...base, profile, completeness: getProfileCompleteness(user, profile) };
  }
  if (user.role === ROLES.RECRUITER) return { ...base, profile: toRecruiterProfile(user.recruiterProfile ?? {}) };
  return { ...base, profile: {} };
}

/** What admin screens show about an account. */
function toUserSummary(user) {
  return {
    id: id(user),
    name: user.name ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    companyName: user.role === ROLES.RECRUITER ? (user.recruiterProfile?.companyName ?? '') : '',
  };
}

/**
 * What a recruiter may see about an applicant: name, contact details and profile — never the
 * account status, dates or anything about the password.
 */
function toCandidate(student) {
  if (!student || student.role !== ROLES.STUDENT) return null;
  return {
    id: id(student),
    name: student.name,
    email: student.email,
    phone: student.phone ?? '',
    profile: toStudentProfile(student.studentProfile ?? {}),
  };
}

/** A job as its owner or an admin sees it. */
function toJob(job, now = new Date()) {
  return {
    id: id(job),
    recruiterId: id(job.recruiter),
    title: job.title,
    companyName: job.companyName,
    location: job.location,
    jobType: job.jobType,
    workMode: job.workMode,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryPeriod: job.salaryPeriod,
    experience: job.experience,
    skills: [...(job.skills ?? [])],
    description: job.description,
    responsibilities: [...(job.responsibilities ?? [])],
    eligibility: {
      degrees: [...(job.eligibility?.degrees ?? [])],
      graduationYears: [...(job.eligibility?.graduationYears ?? [])],
      minCgpa: job.eligibility?.minCgpa ?? null,
    },
    openings: job.openings,
    deadline: job.deadline,
    status: job.status,
    rejectionReason: job.rejectionReason ?? '',
    postedAt: job.postedAt,
    updatedAt: job.updatedAt,
    isExpired: isExpired(job.deadlineAt, now),
  };
}

/** A job as students and visitors see it: no moderation notes. */
function toPublicJob(job, now = new Date()) {
  const { rejectionReason, ...publicJob } = toJob(job, now);
  return publicJob;
}

/** Just enough of a job to label an application or a saved link whose job is no longer open. */
function toJobSummary(job) {
  return job ? { id: id(job), title: job.title, companyName: job.companyName } : null;
}

function toApplication(application) {
  return {
    id: id(application),
    jobId: id(application.job),
    studentId: id(application.student),
    coverNote: application.coverNote ?? '',
    resumeFileName: application.resumeFileName ?? null,
    status: application.status,
    statusHistory: (application.statusHistory ?? []).map(({ status, at, note }) => ({ status, at, note: note ?? '' })),
    appliedAt: application.appliedAt,
    updatedAt: application.updatedAt,
  };
}

function toNotification(notification) {
  return {
    id: id(notification),
    userId: id(notification.user),
    type: notification.type,
    title: notification.title,
    message: notification.message ?? '',
    link: notification.link ?? '',
    read: Boolean(notification.read),
    createdAt: notification.createdAt,
  };
}

module.exports = {
  toUser, toUserSummary, toCandidate, toJob, toPublicJob, toJobSummary, toApplication, toNotification,
};
