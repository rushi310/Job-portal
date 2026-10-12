/**
 * application-service.js — Job applications (PROJECT_SPEC.md §4.3, BR-12 – BR-17).
 * Students apply, list and withdraw their own applications. Recruiters review applications to
 * their own jobs only: ownership is always application.job → job.recruiter, checked against the
 * authenticated user. Status changes are conditional updates, so two requests arriving together
 * cannot both succeed, and every change is appended to the status history.
 */

const Application = require('../models/application');
const Job = require('../models/job');
const User = require('../models/user');
const SavedJob = require('../models/saved-job');
const Resume = require('../models/resume');
const {
  ROLES, JOB_STATUS, APPLICATION_STATUS, RECRUITER_STATUS_FLOW, WITHDRAWABLE_STATUSES,
  NOTIFICATION_TYPES, PAGE_PATHS,
} = require('../config/constants');
const { notFound, conflict, assertValid } = require('../utils/app-error');
const { isExpired } = require('../utils/dates');
const {
  toApplication, toJob, toPublicJob, toJobSummary, toCandidate,
} = require('../utils/serializers');
const { describePage, toPageInfo } = require('../utils/pagination');
const { validateApplicationForm } = require('../validators/admin-validator');
const { findVisibleJob, findOwnJob } = require('./job-service');
const { createNotification } = require('./notification-service');

const DUPLICATE_KEY = 11000;
const STATUS_LABELS = Object.freeze({
  applied: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  selected: 'Selected',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
});
/** Titles for the student's "application status changed" notification (§4.5). */
const STATUS_NOTIFICATION_TITLES = Object.freeze({
  under_review: 'Application under review',
  shortlisted: 'Application shortlisted',
  interview: 'Moved to interview',
  selected: 'You have been selected',
  rejected: 'Application not selected',
});

const JOB_AVAILABILITY = Object.freeze({
  OPEN: 'open', EXPIRED: 'expired', CLOSED: 'closed', UNAVAILABLE: 'unavailable',
});

/** Availability of a job referenced by an application or a saved job. */
function getJobAvailability(job) {
  if (!job) return JOB_AVAILABILITY.UNAVAILABLE;
  if (job.status === JOB_STATUS.CLOSED) return JOB_AVAILABILITY.CLOSED;
  if (job.status !== JOB_STATUS.APPROVED) return JOB_AVAILABILITY.UNAVAILABLE;
  return isExpired(job.deadlineAt) ? JOB_AVAILABILITY.EXPIRED : JOB_AVAILABILITY.OPEN;
}

/**
 * A referenced job as a student may see it: the full public job while it is approved, otherwise
 * only its title and company (so history stays readable after a job closes or is removed).
 */
function toReferencedJob(job) {
  const availability = getJobAvailability(job);
  const isVisible = availability === JOB_AVAILABILITY.OPEN || availability === JOB_AVAILABILITY.EXPIRED;
  return { job: isVisible ? toPublicJob(job) : toJobSummary(job), availability };
}

/* ==========================================================================
   Eligibility and applying (student)
   ========================================================================== */

/**
 * Check each eligibility rule of a job against the student's profile (BR-14).
 * Rules with no requirement (empty list / no minimum) always pass.
 */
function checkEligibility(student, job) {
  const profile = student.studentProfile ?? {};
  const { degrees = [], graduationYears = [], minCgpa = null } = job.eligibility ?? {};
  const cgpa = Number.isFinite(profile.cgpa) ? profile.cgpa : null;
  const rules = [
    {
      label: 'Degree',
      requirement: degrees.length ? degrees.join(', ') : 'Any degree',
      yours: profile.degree || 'Not provided',
      met: degrees.length === 0 || degrees.includes(profile.degree),
    },
    {
      label: 'Graduation year',
      requirement: graduationYears.length ? graduationYears.join(', ') : 'Any year',
      yours: Number.isFinite(profile.graduationYear) ? String(profile.graduationYear) : 'Not provided',
      met: graduationYears.length === 0 || graduationYears.includes(profile.graduationYear),
    },
    {
      label: 'Minimum CGPA',
      requirement: minCgpa === null ? 'No minimum' : String(minCgpa),
      yours: cgpa === null ? 'Not provided' : String(cgpa),
      met: minCgpa === null || (cgpa !== null && cgpa >= minCgpa),
    },
  ];
  return { isEligible: rules.every((rule) => rule.met), rules };
}

/** Can this student apply to this job now? The first failing rule is reported. */
function getApplyStatus(job, application, eligibility) {
  if (application) return { canApply: false, code: 'ALREADY_APPLIED', message: 'You have already applied to this job.' };
  if (isExpired(job.deadlineAt)) {
    return { canApply: false, code: 'JOB_EXPIRED', message: 'The application deadline for this job has passed.' };
  }
  if (!eligibility.isEligible) {
    return { canApply: false, code: 'NOT_ELIGIBLE', message: 'You do not meet the eligibility criteria for this job.' };
  }
  return { canApply: true };
}

/** Everything the Job Details page needs about one approved job, for the logged-in student. */
async function getJobDetailsForStudent(student, jobId) {
  const job = await findVisibleJob(jobId);
  const [application, saved] = await Promise.all([
    Application.findOne({ student: student._id, job: job._id }),
    SavedJob.exists({ student: student._id, job: job._id }),
  ]);
  const eligibility = checkEligibility(student, job);
  return {
    job: toPublicJob(job),
    isSaved: Boolean(saved),
    application: application ? toApplication(application) : null,
    eligibility,
    applyStatus: getApplyStatus(job, application, eligibility),
  };
}

/**
 * Apply to a job as the authenticated student. Every rule is checked here whatever the page
 * showed: approved job, deadline, one application per job (BR-13), eligibility (BR-14), cover note.
 */
async function applyToJob(student, jobId, form = {}) {
  const job = await findVisibleJob(jobId);
  const existing = await Application.exists({ student: student._id, job: job._id });
  const status = getApplyStatus(job, existing, checkEligibility(student, job));
  if (!status.canApply) throw conflict(status.code, status.message);
  assertValid(validateApplicationForm(form), 'Please correct the highlighted field.');

  const now = new Date();
  let application;
  try {
    application = await Application.create({
      job: job._id,
      student: student._id,
      coverNote: (form.coverNote ?? '').trim(),
      resumeFileName: student.studentProfile?.resume?.fileName ?? null, // BR-17: reference only
      status: APPLICATION_STATUS.APPLIED,
      statusHistory: [{ status: APPLICATION_STATUS.APPLIED, at: now, note: '' }], // BR-16
      appliedAt: now,
      updatedAt: now,
    });
  } catch (error) {
    // A second request slipped in between the check and the insert: the unique index refuses it.
    if (error.code === DUPLICATE_KEY) throw conflict('ALREADY_APPLIED', 'You have already applied to this job.');
    throw error;
  }
  // §4.5: the recruiter who owns the job hears about the new applicant.
  await createNotification({
    user: job.recruiter,
    type: NOTIFICATION_TYPES.APPLICATION,
    title: 'New applicant',
    message: `${student.name} applied for ${job.title}.`,
    link: `${PAGE_PATHS.APPLICANTS}?jobId=${job._id}`,
  });
  return toApplication(application);
}

/** Number of the student's applications in each status, plus the total. */
async function countByStatusForStudent(studentId) {
  const rows = await Application.aggregate([
    { $match: { student: studentId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byStatus = new Map(rows.map((row) => [row._id, row.count]));
  const counts = Object.fromEntries(Object.values(APPLICATION_STATUS).map((status) => [status, byStatus.get(status) ?? 0]));
  return { all: rows.reduce((sum, row) => sum + row.count, 0), ...counts };
}

/**
 * The student's own applications, most recent activity first, each with its job's current
 * availability. Applications are history: they stay listed when the job closes or disappears.
 */
async function listForStudent(student, { status = '' } = {}, paging) {
  const filter = { student: student._id };
  if (status) filter.status = status;
  const [counts, total] = await Promise.all([
    countByStatusForStudent(student._id),
    Application.countDocuments(filter),
  ]);
  const page = describePage(total, paging);
  const applications = await Application.find(filter)
    .sort({ updatedAt: -1, _id: -1 })
    .skip(page.skip)
    .limit(page.limit);
  // Jobs are looked up separately so an application keeps its job id even after the job is deleted.
  const jobs = await Job.find({ _id: { $in: applications.map((application) => application.job) } });
  const jobsById = new Map(jobs.map((job) => [String(job._id), job]));
  return {
    items: applications.map((application) => ({
      application: toApplication(application),
      ...toReferencedJob(jobsById.get(String(application.job)) ?? null),
    })),
    counts,
    ...toPageInfo(page, applications.length),
  };
}

/**
 * Withdraw one of the student's own applications, only from `applied` / `under_review` (BR-15).
 * Withdrawn is final and still blocks re-applying (BR-13).
 */
async function withdrawApplication(student, applicationId) {
  const now = new Date();
  const updated = await Application.findOneAndUpdate(
    { _id: applicationId, student: student._id, status: { $in: WITHDRAWABLE_STATUSES } },
    {
      $set: { status: APPLICATION_STATUS.WITHDRAWN, updatedAt: now },
      $push: { statusHistory: { status: APPLICATION_STATUS.WITHDRAWN, at: now, note: 'Withdrawn by student.' } },
    },
    { new: true },
  );
  if (updated) return toApplication(updated);
  // Find out why nothing changed, without revealing other students' applications.
  const own = await Application.exists({ _id: applicationId, student: student._id });
  if (!own) throw notFound('Application not found.');
  throw conflict('CANNOT_WITHDRAW', 'This application can no longer be withdrawn.');
}

/* ==========================================================================
   Recruiter review
   ========================================================================== */

/** Ids of the recruiter's own jobs. */
const getOwnJobIds = (recruiterId) => Job.find({ recruiter: recruiterId }).distinct('_id');

/** Applications to the recruiter's own jobs (newest first), optionally limited. */
async function findRecruiterApplications(recruiterId, { limit = 0, select = '' } = {}) {
  const jobIds = await getOwnJobIds(recruiterId);
  if (jobIds.length === 0) return [];
  const query = Application.find({ job: { $in: jobIds } }).sort({ appliedAt: -1, _id: -1 });
  if (select) query.select(select);
  if (limit) query.limit(limit);
  return query;
}

/** Names of the given students. @returns {Promise<Map<string, string>>} */
async function getStudentNames(studentIds) {
  const students = await User.find({ _id: { $in: studentIds }, role: ROLES.STUDENT }).select('name');
  return new Map(students.map((student) => [String(student._id), student.name]));
}

async function withCandidateNames(applications) {
  const names = await getStudentNames(applications.map((application) => application.student));
  return applications.map((application) => ({
    application: toApplication(application),
    candidateName: names.get(String(application.student)) ?? 'Unknown student',
  }));
}

/** The newest applicants across the recruiter's own jobs, with the job title of each. */
async function listRecentApplicants(recruiter, limit) {
  const applications = await findRecruiterApplications(recruiter._id, { limit });
  const jobs = await Job.find({ _id: { $in: applications.map((application) => application.job) } }).select('title');
  const titles = new Map(jobs.map((job) => [String(job._id), job.title]));
  const items = await withCandidateNames(applications);
  return items.map((item) => ({ ...item, jobTitle: titles.get(item.application.jobId) ?? 'Job' }));
}

/** Applicants for one of the recruiter's own jobs. Another recruiter's job is "not found". */
async function listApplicantsForJob(recruiter, jobId) {
  const job = await findOwnJob(recruiter._id, jobId);
  const applications = await Application.find({ job: job._id }).sort({ appliedAt: -1, _id: -1 });
  return { job: toJob(job), items: await withCandidateNames(applications) };
}

/** An application to one of the recruiter's own jobs, with that job; otherwise "not found". */
async function findOwnedApplication(recruiterId, applicationId) {
  const application = await Application.findById(applicationId).populate('job');
  if (!application?.job || String(application.job.recruiter) !== String(recruiterId)) {
    throw notFound('Application not found.');
  }
  return application;
}

/** Full review data for one application to the recruiter's own job. */
async function getApplicantDetails(recruiter, applicationId) {
  const application = await findOwnedApplication(recruiter._id, applicationId);
  const student = await User.findById(application.student);
  return {
    application: toApplication(application),
    job: toJob(application.job),
    candidate: toCandidate(student),
  };
}

/**
 * The applicant's current resume file — only through an application to the recruiter's own job.
 * @returns {Promise<{ data: Buffer, fileName: string, contentType: string }>}
 */
async function getApplicantResume(recruiter, applicationId) {
  const application = await findOwnedApplication(recruiter._id, applicationId);
  const resume = await Resume.findOne({ student: application.student });
  if (!resume) throw notFound('This student has no resume on their profile now.', 'NO_RESUME');
  return { data: resume.data, fileName: resume.fileName, contentType: resume.contentType };
}

/**
 * Move an application one step along its status flow (BR-15) as the recruiter who owns the job.
 * The change is appended to the history (BR-16) and the student is notified (§4.5).
 */
async function updateApplicationStatus(recruiter, applicationId, newStatus) {
  const application = await findOwnedApplication(recruiter._id, applicationId);
  const allowed = RECRUITER_STATUS_FLOW[application.status] ?? [];
  if (typeof newStatus !== 'string' || !allowed.includes(newStatus)) {
    throw conflict('INVALID_TRANSITION', 'This status change is not allowed.');
  }

  const now = new Date();
  // Conditional on the status read above: if the student withdrew meanwhile, nothing is changed.
  const updated = await Application.findOneAndUpdate(
    { _id: application._id, status: application.status },
    {
      $set: { status: newStatus, updatedAt: now },
      $push: { statusHistory: { status: newStatus, at: now, note: '' } },
    },
    { new: true },
  );
  if (!updated) throw conflict('INVALID_TRANSITION', 'This application was changed just now. Please reload and try again.');

  const { job } = application;
  await createNotification({
    user: updated.student,
    type: NOTIFICATION_TYPES.STATUS,
    title: STATUS_NOTIFICATION_TITLES[newStatus] ?? 'Application updated',
    message: `Your application for ${job.title} at ${job.companyName} is now: ${STATUS_LABELS[newStatus]}.`,
    link: PAGE_PATHS.APPLICATIONS,
  });
  return toApplication(updated);
}

module.exports = {
  JOB_AVAILABILITY,
  getJobAvailability,
  toReferencedJob,
  checkEligibility,
  getJobDetailsForStudent,
  applyToJob,
  countByStatusForStudent,
  listForStudent,
  withdrawApplication,
  findRecruiterApplications,
  listRecentApplicants,
  listApplicantsForJob,
  getApplicantDetails,
  getApplicantResume,
  updateApplicationStatus,
};
