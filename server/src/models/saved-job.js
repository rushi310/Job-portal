/**
 * saved-job.js — A student's saved-job link (PROJECT_SPEC.md §5.4, BR-18).
 * Only the relationship is stored; the unique index stops a job being saved twice.
 */

const { Schema, model } = require('mongoose');

const savedJobSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  savedAt: { type: Date, default: Date.now },
});

savedJobSchema.index({ student: 1, job: 1 }, { unique: true });
savedJobSchema.index({ student: 1, savedAt: -1 });

module.exports = model('SavedJob', savedJobSchema);
