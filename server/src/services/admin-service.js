/**
 * admin-service.js — Admin moderation (PROJECT_SPEC.md §3.4, BR-06, BR-09, BR-20).
 * Routes that call this service require an authenticated admin. Users: approve recruiters,
 * block / unblock, delete with cleanup of their related data. Jobs: approve / reject with a
 * reason (pending only), delete. Announcements. Admin accounts are never changed from here.
 */

const User = require('../models/user');
const Job = require('../models/job');
const Application = require('../models/application');
const SavedJob = require('../models/saved-job');
const Notification = require('../models/notification');
const Resume = require('../models/resume');
const { config } = require('../config/env');
const {
  ROLES, USER_STATUS, JOB_STATUS, NOTIFICATION_TYPES, ANNOUNCEMENT_AUDIENCES, PAGE_PATHS,
} = require('../config/constants');
const {
  notFound, conflict, forbidden, validationFailed, assertValid,
} = require('../utils/app-error');
const { text, containsPattern, toWords } = require('../utils/text');
const { toUserSummary, toJob } = require('../utils/serializers');
const { describePage, toPageInfo } = require('../utils/pagination');
const { validateRejectionReason, validateAnnouncement } = require('../validators/admin-validator');
const { countApplicationsByJob } = require('./job-service');
const { countByField } = require('./analytics-service');
const { createNotification, createNotifications } = require('./notification-service');
const { seedDatabase, loadSeedData } = require('./seed-service');

const QUICK_LIST_SIZE = 5;
const MAX_SENT_ANNOUNCEMENTS = 100;

/* ==========================================================================
   Dashboard
   ========================================================================== */

async function attachRecruiterNames(jobs) {
  const recruiters = await User.find({ _id: { $in: jobs.map((job) => job.recruiter) } }).select('name');
  const names = new Map(recruiters.map((user) => [String(user._id), user.name]));
  return (job) => names.get(String(job.recruiter)) ?? 'Deleted recruiter';
}

/** Platform totals plus the newest recruiters and jobs waiting for approval. */
async function getDashboard() {
  const pendingRecruiterFilter = { role: ROLES.RECRUITER, status: USER_STATUS.PENDING };
  const [usersByRole, jobsByStatus, applications, pendingRecruiterCount, pendingRecruiters, pendingJobs] = await Promise.all([
    countByField(User, 'role'),
    countByField(Job, 'status'),
    Application.countDocuments(),
    User.countDocuments(pendingRecruiterFilter),
    User.find(pendingRecruiterFilter).sort({ createdAt: -1 }).limit(QUICK_LIST_SIZE),
    Job.find({ status: JOB_STATUS.PENDING }).sort({ postedAt: -1 }).limit(QUICK_LIST_SIZE),
  ]);
  const nameOf = await attachRecruiterNames(pendingJobs);
  const byStatus = Object.fromEntries(Object.values(JOB_STATUS).map((status) => [status, jobsByStatus[status] ?? 0]));
  return {
    stats: {
      students: usersByRole[ROLES.STUDENT] ?? 0,
      recruiters: usersByRole[ROLES.RECRUITER] ?? 0,
      pendingRecruiters: pendingRecruiterCount,
      jobs: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      jobsByStatus: byStatus,
      applications,
    },
    pendingRecruiters: pendingRecruiters.map(toUserSummary),
    pendingJobs: pendingJobs.map((job) => ({ job: toJob(job), recruiterName: nameOf(job) })),
    demoResetEnabled: config.allowDemoReset,
  };
}

/* ==========================================================================
   Users
   ========================================================================== */

/** Which actions an admin may take on an account (the rules the write functions enforce). */
function getUserActions(user, adminId) {
  if (user.role === ROLES.ADMIN || String(user._id) === String(adminId)) {
    return { approve: false, block: false, unblock: false, remove: false };
  }
  return {
    approve: user.role === ROLES.RECRUITER && user.status === USER_STATUS.PENDING,
    block: user.status === USER_STATUS.ACTIVE,
    unblock: user.status === USER_STATUS.BLOCKED,
    remove: true,
  };
}

/** Users matching a search (name, email, company) and filters, newest account first. */
async function listUsers(admin, { query = '', role = '', status = '' } = {}, paging) {
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  const words = toWords(query);
  if (words.length > 0) {
    filter.$and = words.map((word) => {
      const pattern = containsPattern(word);
      return { $or: [{ name: pattern }, { email: pattern }, { 'recruiterProfile.companyName': pattern }] };
    });
  }
  const page = describePage(await User.countDocuments(filter), paging);
  const users = await User.find(filter).sort({ createdAt: -1, _id: -1 }).skip(page.skip).limit(page.limit);
  return {
    items: users.map((user) => ({ ...toUserSummary(user), actions: getUserActions(user, admin._id) })),
    ...toPageInfo(page, users.length),
  };
}

/** Find an account the admin may act on, or throw. */
async function findManagedUser(admin, userId, action) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found.');
  if (String(user._id) === String(admin._id)) throw conflict('INVALID_ACTION', 'You cannot change your own account.');
  if (!getUserActions(user, admin._id)[action]) {
    throw conflict('INVALID_ACTION', 'This action is not available for this account.');
  }
  return user;
}

/** Change an account's status only if it is still in the status the action starts from. */
async function setStatus(admin, userId, action, fromStatus, toStatus) {
  const user = await findManagedUser(admin, userId, action);
  const updated = await User.findOneAndUpdate(
    { _id: user._id, status: fromStatus, role: { $ne: ROLES.ADMIN } },
    { $set: { status: toStatus } },
    { new: true },
  );
  if (!updated) throw conflict('INVALID_ACTION', 'This account was changed just now. Please reload and try again.');
  return updated;
}

/** Approve a pending recruiter: `pending` → `active` (they can post jobs straight away, BR-07). */
async function approveRecruiter(admin, userId) {
  const user = await setStatus(admin, userId, 'approve', USER_STATUS.PENDING, USER_STATUS.ACTIVE);
  await createNotification({ // §4.5: recruiter account approved → recruiter
    user: user._id,
    type: NOTIFICATION_TYPES.ACCOUNT,
    title: 'Account approved',
    message: 'Your recruiter account has been approved. You can now post jobs.',
    link: PAGE_PATHS.POST_JOB,
  });
  return toUserSummary(user);
}

/** Block an active account: login is refused and open sessions end on their next request (BR-03). */
async function blockUser(admin, userId) {
  return toUserSummary(await setStatus(admin, userId, 'block', USER_STATUS.ACTIVE, USER_STATUS.BLOCKED));
}

async function unblockUser(admin, userId) {
  return toUserSummary(await setStatus(admin, userId, 'unblock', USER_STATUS.BLOCKED, USER_STATUS.ACTIVE));
}

/**
 * Delete a student or recruiter and their related data:
 * - student: their applications, saved jobs, notifications and resume;
 * - recruiter: their jobs, every application and saved job for those jobs, and their notifications.
 * The account itself goes last, so a failure part-way never leaves data without an owner.
 */
async function deleteUser(admin, userId) {
  const user = await findManagedUser(admin, userId, 'remove');
  const ownJobIds = user.role === ROLES.RECRUITER ? await Job.find({ recruiter: user._id }).distinct('_id') : [];
  const related = { $or: [{ student: user._id }, { job: { $in: ownJobIds } }] };

  const [applications, savedJobs] = await Promise.all([
    Application.deleteMany(related),
    SavedJob.deleteMany(related),
    Notification.deleteMany({ user: user._id }),
    Resume.deleteOne({ student: user._id }),
  ]);
  await Job.deleteMany({ _id: { $in: ownJobIds } });
  await User.deleteOne({ _id: user._id, role: { $ne: ROLES.ADMIN } });
  return {
    user: toUserSummary(user),
    removed: { jobs: ownJobIds.length, applications: applications.deletedCount, savedJobs: savedJobs.deletedCount },
  };
}

/* ==========================================================================
   Jobs
   ========================================================================== */

/** All jobs (every status), newest first, with the recruiter's name and applicant count. */
async function listJobs({ status = '' } = {}, paging) {
  const filter = status ? { status } : {};
  const [jobsByStatus, total] = await Promise.all([countByField(Job, 'status'), Job.countDocuments(filter)]);
  const page = describePage(total, paging);
  const jobs = await Job.find(filter).sort({ postedAt: -1, _id: -1 }).skip(page.skip).limit(page.limit);
  const [nameOf, applicantCounts] = await Promise.all([
    attachRecruiterNames(jobs),
    countApplicationsByJob(jobs.map((job) => job._id)),
  ]);
  const counts = Object.fromEntries(Object.values(JOB_STATUS).map((value) => [value, jobsByStatus[value] ?? 0]));
  return {
    items: jobs.map((job) => ({
      job: toJob(job),
      recruiterName: nameOf(job),
      applicantCount: applicantCounts.get(String(job._id)) ?? 0,
    })),
    counts: { all: Object.values(counts).reduce((sum, count) => sum + count, 0), ...counts },
    ...toPageInfo(page, jobs.length),
  };
}

/**
 * Approve or reject a job — only while it is `pending` (BR-09). Only the status and the rejection
 * reason change: the owner, company and every recruiter-entered field stay exactly as they were.
 */
async function decideJob(jobId, change) {
  const updated = await Job.findOneAndUpdate(
    { _id: jobId, status: JOB_STATUS.PENDING },
    { $set: { ...change, updatedAt: new Date() } },
    { new: true },
  );
  if (!updated) {
    if (!(await Job.exists({ _id: jobId }))) throw notFound('Job not found.');
    throw conflict('INVALID_ACTION', 'Only pending jobs can be approved or rejected.');
  }
  const isApproved = updated.status === JOB_STATUS.APPROVED;
  await createNotification({ // §4.5: job approved / rejected → the recruiter who owns it
    user: updated.recruiter,
    type: NOTIFICATION_TYPES.JOB,
    title: isApproved ? 'Job approved' : 'Job rejected',
    message: isApproved
      ? `Your job "${updated.title}" is now live for students.`
      : `"${updated.title}" was rejected: ${updated.rejectionReason}`,
    link: PAGE_PATHS.MY_JOBS,
  });
  return toJob(updated);
}

const approveJob = (jobId) => decideJob(jobId, { status: JOB_STATUS.APPROVED, rejectionReason: '' });

async function rejectJob(jobId, reason) {
  const message = validateRejectionReason(reason);
  if (message) throw validationFailed({ reason: message }, message);
  return decideJob(jobId, { status: JOB_STATUS.REJECTED, rejectionReason: text(reason) });
}

/**
 * Delete a job. Its applications and saved links stay as history (PROJECT_SPEC §3.2): students
 * see "Job no longer available".
 */
async function deleteJob(jobId) {
  const job = await Job.findByIdAndDelete(jobId);
  if (!job) throw notFound('Job not found.');
  return toJob(job);
}

/* ==========================================================================
   Announcements
   ========================================================================== */

/** Send an announcement: one notification per account in the audience that can log in. */
async function sendAnnouncement(values = {}) {
  assertValid(validateAnnouncement(values));
  const roles = ANNOUNCEMENT_AUDIENCES[text(values.audience)];
  const recipients = await User.find({ role: { $in: roles }, status: { $ne: USER_STATUS.BLOCKED } }).distinct('_id');
  if (recipients.length === 0) throw conflict('INVALID_ACTION', 'There is nobody in this audience yet.');

  const created = await createNotifications(recipients.map((user) => ({
    user,
    type: NOTIFICATION_TYPES.ANNOUNCEMENT,
    title: text(values.title),
    message: text(values.message),
  })));
  if (created === 0) throw conflict('SEND_FAILED', 'The announcement could not be sent. Please try again.');
  return { recipients: created };
}

/**
 * Sent announcements, newest first, rebuilt from the announcement notifications: one entry per
 * send (same title, message and time). The audience is worked out from the recipients' roles.
 */
async function listSentAnnouncements() {
  const groups = await Notification.aggregate([
    { $match: { type: NOTIFICATION_TYPES.ANNOUNCEMENT } },
    {
      $group: {
        _id: { title: '$title', message: '$message', createdAt: '$createdAt' },
        users: { $push: '$user' },
      },
    },
    { $sort: { '_id.createdAt': -1 } },
    { $limit: MAX_SENT_ANNOUNCEMENTS },
  ]);
  const recipients = await User.find({ _id: { $in: groups.flatMap((group) => group.users) } }).select('role');
  const roles = new Map(recipients.map((user) => [String(user._id), user.role]));
  return groups.map((group) => {
    const groupRoles = new Set(group.users.map((user) => roles.get(String(user))).filter(Boolean));
    const audience = groupRoles.size > 1 ? 'all' : groupRoles.has(ROLES.RECRUITER) ? 'recruiters' : 'students';
    return {
      title: group._id.title,
      message: group._id.message,
      sentAt: group._id.createdAt,
      recipients: group.users.length,
      audience,
    };
  });
}

/* ==========================================================================
   Reset demo data (BR-20)
   ========================================================================== */

/**
 * Replace everything except admin accounts with the demo data. This erases real data, so it only
 * works when the deployment explicitly allows it (ALLOW_DEMO_RESET=true). Admin accounts are kept
 * as they are, so the admin stays logged in and keeps their password.
 */
async function resetDemoData() {
  if (!config.allowDemoReset) {
    throw forbidden('Resetting demo data is turned off on this server.', 'FEATURE_DISABLED');
  }
  const data = loadSeedData(); // read first: if the files cannot be loaded, nothing is deleted
  await Promise.all([
    Application.deleteMany({}),
    SavedJob.deleteMany({}),
    Notification.deleteMany({}),
    Resume.deleteMany({}),
    Job.deleteMany({}),
  ]);
  await User.deleteMany({ role: { $ne: ROLES.ADMIN } });
  return seedDatabase({ skipAdmins: true }, data);
}

module.exports = {
  getDashboard,
  listUsers,
  approveRecruiter,
  blockUser,
  unblockUser,
  deleteUser,
  listJobs,
  approveJob,
  rejectJob,
  deleteJob,
  sendAnnouncement,
  listSentAnnouncements,
  resetDemoData,
};
