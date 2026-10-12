/**
 * application.js — Job applications (PROJECT_SPEC.md §5.3).
 * The unique { student, job } index is the database guarantee behind BR-13 (one application per
 * job, even if two requests arrive together). Job and student data are referenced, not copied;
 * the recruiter is always found through the job.
 */

const { Schema, model } = require('mongoose');
const { APPLICATION_STATUS } = require('../config/constants');

const historyEntrySchema = new Schema({
  status: { type: String, enum: Object.values(APPLICATION_STATUS), required: true },
  at: { type: Date, required: true },
  note: { type: String, default: '' },
}, { _id: false });

const applicationSchema = new Schema({
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coverNote: { type: String, default: '' },
  // Name of the resume on the profile when applying (BR-17); null when there was none.
  resumeFileName: { type: String, default: null },
  status: { type: String, enum: Object.values(APPLICATION_STATUS), default: APPLICATION_STATUS.APPLIED },
  statusHistory: { type: [historyEntrySchema], default: [] }, // BR-16: appended to, never rewritten
  legacyId: { type: String, unique: true, sparse: true },
  appliedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

applicationSchema.index({ student: 1, job: 1 }, { unique: true });
applicationSchema.index({ student: 1, updatedAt: -1 }); // My Applications
applicationSchema.index({ job: 1, appliedAt: -1 }); // applicants of a job

module.exports = model('Application', applicationSchema);
