/**
 * resume.js — A student's resume file (PDF, at most 500 KB), one per student.
 * The bytes are kept in MongoDB so the free-tier deployment needs no separate file storage.
 * The file is never public: it is served only through authorised API routes (the student's own
 * resume, or the resume of an applicant to the recruiter's own job).
 */

const { Schema, model } = require('mongoose');

const resumeSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fileName: { type: String, required: true },
  contentType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  data: { type: Buffer, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = model('Resume', resumeSchema);
