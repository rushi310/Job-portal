/**
 * job.js — Job postings (PROJECT_SPEC.md §5.2).
 * `deadlineAt` and `annualPay` are derived from the recruiter's own fields whenever a job is
 * saved; they exist only so MongoDB can filter open jobs and sort by pay with an index.
 */

const { Schema, model } = require('mongoose');
const {
  JOB_STATUS, JOB_TYPES, WORK_MODES, SALARY_PERIODS,
} = require('../config/constants');
const { endOfDay } = require('../utils/dates');

const jobSchema = new Schema({
  recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  // Copied from the recruiter's profile when the job is created; later renames do not change it.
  companyName: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  jobType: { type: String, enum: Object.values(JOB_TYPES), required: true },
  workMode: { type: String, enum: Object.values(WORK_MODES), required: true },
  salaryMin: { type: Number, default: 0 },
  salaryMax: { type: Number, default: 0 },
  salaryPeriod: { type: String, enum: Object.values(SALARY_PERIODS), required: true },
  experience: { type: String, default: '' },
  skills: { type: [String], default: [] },
  description: { type: String, default: '' },
  responsibilities: { type: [String], default: [] },
  eligibility: {
    degrees: { type: [String], default: [] },
    graduationYears: { type: [Number], default: [] },
    minCgpa: { type: Number, default: null },
  },
  openings: { type: Number, default: 1 },
  deadline: { type: String, required: true }, // "YYYY-MM-DD"
  deadlineAt: { type: Date, default: null },
  annualPay: { type: Number, default: 0 },
  status: { type: String, enum: Object.values(JOB_STATUS), default: JOB_STATUS.PENDING },
  rejectionReason: { type: String, default: '' },
  legacyId: { type: String, unique: true, sparse: true },
  postedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

/**
 * Values worked out from a job's own fields: the moment the deadline day ends, a maximum that is
 * never below the minimum, and yearly pay for sorting (monthly stipends × 12, undisclosed = 0).
 */
function deriveJobFields({ deadline, salaryMin, salaryMax, salaryPeriod }) {
  const min = Number(salaryMin) || 0;
  const max = Math.max(Number(salaryMax) || min, min);
  return {
    salaryMin: min,
    salaryMax: max,
    deadlineAt: endOfDay(deadline),
    annualPay: salaryPeriod === SALARY_PERIODS.MONTH ? max * 12 : max,
  };
}

jobSchema.pre('validate', function setDerivedFields(next) {
  Object.assign(this, deriveJobFields(this));
  next();
});

jobSchema.index({ recruiter: 1, postedAt: -1 }); // a recruiter's own jobs
jobSchema.index({ status: 1, deadlineAt: 1, postedAt: -1 }); // open jobs for students; admin status filter
jobSchema.index({ status: 1, annualPay: -1 });

const Job = model('Job', jobSchema);

module.exports = Job;
module.exports.deriveJobFields = deriveJobFields;
