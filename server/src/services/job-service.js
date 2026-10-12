/**
 * job-service.js — Jobs: what students and visitors may see (BR-08, BR-12), search, and a
 * recruiter's own job management (BR-07 – BR-11). The recruiter is always the authenticated user;
 * owner, company and status never come from the request.
 */

const Job = require('../models/job');
const Application = require('../models/application');
const SavedJob = require('../models/saved-job');
const {
  JOB_STATUS, JOB_TYPES, WORK_MODES, PAY_RANGES, LIMITS,
} = require('../config/constants');
const {
  AppError, notFound, conflict, assertValid,
} = require('../utils/app-error');
const {
  text, containsPattern, exactPattern, toWords, uniqueSorted,
} = require('../utils/text');
const { toJob, toPublicJob } = require('../utils/serializers');
const { describePage, toPageInfo } = require('../utils/pagination');
const { validateJobForm, buildJobFields } = require('../validators/job-validator');

/** Statuses a recruiter may edit: rejected and closed jobs are final for the recruiter. */
const EDITABLE_STATUSES = [JOB_STATUS.PENDING, JOB_STATUS.APPROVED];
/** Core fields: changing any of them on an approved job sends it back for approval (BR-11). */
const CORE_FIELDS = ['title', 'description', 'eligibility', 'salaryMin', 'salaryMax', 'salaryPeriod'];
const RECOMMENDATION_POOL = 300;

const SORTS = {
  newest: { postedAt: -1, _id: -1 },
  deadline: { deadlineAt: 1, postedAt: -1 },
  salary: { annualPay: -1, postedAt: -1 },
};

/** Jobs students may see: approved, and (unless asked) with the deadline still ahead. */
function openJobsFilter({ includeExpired = false, now = new Date() } = {}) {
  const filter = { status: JOB_STATUS.APPROVED };
  if (!includeExpired) filter.deadlineAt = { $gte: now };
  return filter;
}

/** Build the MongoDB filter for a parsed job search (all criteria combine with AND). */
function buildSearchFilter(criteria) {
  const filter = openJobsFilter({ includeExpired: criteria.includeExpired });
  const conditions = [];
  // Every typed word must appear in the title, the company or a skill.
  toWords(criteria.query).forEach((word) => {
    const pattern = containsPattern(word);
    conditions.push({ $or: [{ title: pattern }, { companyName: pattern }, { skills: pattern }] });
  });
  // The job must list every selected skill.
  criteria.skills.forEach((skill) => conditions.push({ skills: exactPattern(skill) }));
  if (criteria.location) filter.location = exactPattern(criteria.location);
  if (criteria.jobType) filter.jobType = criteria.jobType;
  if (criteria.workMode) filter.workMode = criteria.workMode;

  const range = PAY_RANGES.find((item) => item.value === criteria.payRange);
  if (range) {
    // Same pay period and overlapping amounts; undisclosed pay (0) never matches a range.
    filter.salaryPeriod = range.period;
    filter.salaryMin = { $gt: 0, $lte: range.max };
    filter.salaryMax = { $gte: range.min };
  }
  if (conditions.length > 0) filter.$and = conditions;
  return filter;
}

/**
 * Search the jobs a student can see, one page at a time, marking the ones they saved.
 * @param {object} criteria from parseJobSearch()
 * @param {{ page: number, limit: number }} paging
 * @param {*} studentId the authenticated student
 */
async function searchJobs(criteria, paging, studentId) {
  const filter = buildSearchFilter(criteria);
  const page = describePage(await Job.countDocuments(filter), paging);
  const jobs = await Job.find(filter).sort(SORTS[criteria.sort]).skip(page.skip).limit(page.limit);
  const saved = await SavedJob.find({ student: studentId, job: { $in: jobs.map((job) => job._id) } }).select('job');
  const savedIds = new Set(saved.map((record) => String(record.job)));
  return {
    items: jobs.map((job) => ({ ...toPublicJob(job), isSaved: savedIds.has(String(job._id)) })),
    ...toPageInfo(page, jobs.length),
  };
}

/** Choices for the location and skills filters, from every approved job (expired included). */
async function getFilterOptions() {
  const filter = openJobsFilter({ includeExpired: true });
  const [locations, skills] = await Promise.all([Job.distinct('location', filter), Job.distinct('skills', filter)]);
  return { locations: uniqueSorted(locations), skills: uniqueSorted(skills) };
}

/** A job a student may open (BR-08): approved, expired or not. Anything else is "not found". */
async function findVisibleJob(jobId) {
  const job = await Job.findOne({ _id: jobId, status: JOB_STATUS.APPROVED });
  if (!job) throw notFound('This job is not available.', 'JOB_NOT_FOUND');
  return job;
}

/** Landing page: headline numbers and the newest open jobs. No login needed, public fields only. */
async function getLandingData() {
  const filter = openJobsFilter();
  const [openJobs, companies, internships, remoteOrHybrid, featured] = await Promise.all([
    Job.countDocuments(filter),
    Job.distinct('companyName', filter),
    Job.countDocuments({ ...filter, jobType: JOB_TYPES.INTERNSHIP }),
    Job.countDocuments({ ...filter, workMode: { $ne: WORK_MODES.ON_SITE } }),
    Job.find(filter).sort(SORTS.newest).limit(LIMITS.FEATURED_JOBS),
  ]);
  return {
    stats: { openJobs, hiringCompanies: companies.length, internships, remoteOrHybrid },
    featuredJobs: featured.map((job) => toPublicJob(job)),
  };
}

const normalizeSkill = (skill) => text(skill).toLowerCase();

/**
 * Jobs recommended for a student: open jobs they have not applied to, ranked by the number of
 * skills that match their profile, then newest. If nothing matches, the newest open jobs are
 * returned and `isSkillBased` is false.
 */
async function getRecommendedJobs(student, limit = 3) {
  const applied = await Application.find({ student: student._id }).distinct('job');
  const candidates = await Job.find({ ...openJobsFilter(), _id: { $nin: applied } })
    .sort(SORTS.newest)
    .limit(RECOMMENDATION_POOL);
  const studentSkills = new Set((student.studentProfile?.skills ?? []).map(normalizeSkill));

  const matched = candidates
    .map((job) => ({ job, matchedSkills: job.skills.filter((skill) => studentSkills.has(normalizeSkill(skill))) }))
    .filter((item) => item.matchedSkills.length > 0)
    .sort((a, b) => b.matchedSkills.length - a.matchedSkills.length); // stable: equal counts stay newest first

  const isSkillBased = matched.length > 0;
  const chosen = isSkillBased ? matched : candidates.map((job) => ({ job, matchedSkills: [] }));
  return {
    items: chosen.slice(0, limit).map(({ job, matchedSkills }) => ({ job: toPublicJob(job), matchedSkills })),
    isSkillBased,
  };
}

/* ==========================================================================
   Recruiter job management
   ========================================================================== */

/** Number of applications per job, for the given job ids. @returns {Promise<Map<string, number>>} */
async function countApplicationsByJob(jobIds) {
  if (jobIds.length === 0) return new Map();
  const rows = await Application.aggregate([
    { $match: { job: { $in: jobIds } } },
    { $group: { _id: '$job', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

/**
 * The recruiter's own jobs (any status), newest first, with applicant counts.
 * Pending recruiters cannot see applicants (BR-07), so their counts are 0.
 */
async function listOwnJobs(recruiter, { status = '', canSeeApplicants = true } = {}) {
  const all = await Job.find({ recruiter: recruiter._id }).sort(SORTS.newest);
  const counts = canSeeApplicants ? await countApplicationsByJob(all.map((job) => job._id)) : new Map();
  const statusCounts = Object.fromEntries(Object.values(JOB_STATUS)
    .map((value) => [value, all.filter((job) => job.status === value).length]));
  return {
    items: all
      .filter((job) => !status || job.status === status)
      .map((job) => ({ job: toJob(job), applicantCount: counts.get(String(job._id)) ?? 0 })),
    counts: { all: all.length, ...statusCounts },
  };
}

/**
 * One of the recruiter's own jobs. Another recruiter's job and an unknown id both give the same
 * "not found", so a recruiter cannot tell which job ids exist.
 */
async function findOwnJob(recruiterId, jobId) {
  const job = await Job.findOne({ _id: jobId, recruiter: recruiterId });
  if (!job) throw notFound('Job not found.');
  return job;
}

/** Post a new job as an approved recruiter. It is saved as `pending` (BR-08). */
async function createJob(recruiter, values = {}) {
  assertValid(validateJobForm(values));
  const job = await Job.create({
    ...buildJobFields(values),
    recruiter: recruiter._id,
    companyName: text(recruiter.recruiterProfile?.companyName) || recruiter.name,
    status: JOB_STATUS.PENDING,
  });
  return toJob(job);
}

/** Did any BR-11 core field change? */
function hasCoreChanges(current, fields) {
  return CORE_FIELDS.some((field) => JSON.stringify(current[field] ?? null) !== JSON.stringify(fields[field] ?? null));
}

/**
 * Edit one of the recruiter's own pending or approved jobs. Owner, company, status, rejection
 * reason and posting date are kept; an approved job whose core fields change goes back to
 * `pending` (BR-11). A recruiter can never make a job `approved`.
 * @returns {Promise<{ job: object, returnedToPending: boolean }>}
 */
async function updateJob(recruiter, jobId, values = {}) {
  const job = await findOwnJob(recruiter._id, jobId);
  if (!EDITABLE_STATUSES.includes(job.status)) {
    throw conflict('CANNOT_EDIT', 'Closed and rejected jobs cannot be edited.');
  }
  assertValid(validateJobForm(values));

  const fields = buildJobFields(values);
  const returnedToPending = job.status === JOB_STATUS.APPROVED && hasCoreChanges(toJob(job), fields);
  const changes = {
    ...fields,
    ...Job.deriveJobFields(fields),
    status: returnedToPending ? JOB_STATUS.PENDING : job.status,
    updatedAt: new Date(),
  };
  // The status is part of the condition, so an approval or closure that happened meanwhile is not overwritten.
  const updated = await Job.findOneAndUpdate(
    { _id: job._id, recruiter: recruiter._id, status: job.status },
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!updated) throw conflict('JOB_CHANGED', 'This job was changed just now. Please reload and try again.');
  return { job: toJob(updated), returnedToPending };
}

/** Close one of the recruiter's own approved jobs (BR-10). Applications are kept. */
async function closeJob(recruiter, jobId) {
  const job = await findOwnJob(recruiter._id, jobId);
  const updated = await Job.findOneAndUpdate(
    { _id: job._id, recruiter: recruiter._id, status: JOB_STATUS.APPROVED },
    { $set: { status: JOB_STATUS.CLOSED, updatedAt: new Date() } },
    { new: true },
  );
  if (!updated) throw new AppError(409, 'CANNOT_CLOSE', 'Only approved jobs can be closed.');
  return toJob(updated);
}

module.exports = {
  openJobsFilter,
  searchJobs,
  getFilterOptions,
  findVisibleJob,
  getLandingData,
  getRecommendedJobs,
  countApplicationsByJob,
  listOwnJobs,
  findOwnJob,
  createJob,
  updateJob,
  closeJob,
};
