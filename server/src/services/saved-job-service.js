/**
 * saved-job-service.js — Saved jobs (PROJECT_SPEC.md §5.4, BR-18).
 * Only the link { student, job } is stored; the student is always the authenticated user.
 */

const SavedJob = require('../models/saved-job');
const Job = require('../models/job');
const { findVisibleJob } = require('./job-service');
const { toReferencedJob } = require('./application-service');

/** Save an approved job (expired included). Saving twice is harmless. */
async function saveJob(student, jobId) {
  const job = await findVisibleJob(jobId);
  // Upsert on the unique { student, job } pair: two clicks can never create two records.
  await SavedJob.updateOne(
    { student: student._id, job: job._id },
    { $setOnInsert: { savedAt: new Date() } },
    { upsert: true },
  );
  return { saved: true };
}

/** Remove the student's saved link. Works even if the job no longer exists. */
async function unsaveJob(student, jobId) {
  await SavedJob.deleteOne({ student: student._id, job: jobId });
  return { saved: false };
}

/**
 * The student's saved jobs, most recently saved first, with each job's current availability.
 * Saved links are never removed automatically, even when the job has gone.
 */
async function listSavedJobs(student) {
  const records = await SavedJob.find({ student: student._id }).sort({ savedAt: -1, _id: -1 });
  const jobs = await Job.find({ _id: { $in: records.map((record) => record.job) } });
  const jobsById = new Map(jobs.map((job) => [String(job._id), job]));
  return {
    items: records.map((record) => ({
      record: { jobId: String(record.job), savedAt: record.savedAt },
      ...toReferencedJob(jobsById.get(String(record.job)) ?? null),
    })),
  };
}

const countSavedJobs = (studentId) => SavedJob.countDocuments({ student: studentId });

module.exports = { saveJob, unsaveJob, listSavedJobs, countSavedJobs };
