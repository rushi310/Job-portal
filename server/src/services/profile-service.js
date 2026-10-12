/**
 * profile-service.js — The authenticated user's own profile: student profile sections and resume,
 * and the recruiter's company profile (PROJECT_SPEC.md §3.2, §3.3).
 * The account being edited is always `req.user`; no id is ever accepted from the request.
 */

const User = require('../models/user');
const Resume = require('../models/resume');
const { RESUME_MIME_TYPE } = require('../config/constants');
const { AppError, badRequest, notFound, assertValid } = require('../utils/app-error');
const { toUser } = require('../utils/serializers');
const {
  PROFILE_SECTIONS, validateProfileSection, buildProfileSection,
  validateCompanyProfile, buildCompanyProfile, validateResumeUpload, sanitizeFileName,
} = require('../validators/profile-validator');

async function applyChanges(userId, changes) {
  const updated = await User.findByIdAndUpdate(userId, { $set: changes }, { new: true, runValidators: true });
  if (!updated) throw notFound('Your account could not be found. Please log in again.');
  return toUser(updated);
}

/** Validate and save one Profile tab for the student. @returns {Promise<object>} the updated user */
async function updateProfileSection(student, section, values = {}) {
  if (!PROFILE_SECTIONS.includes(section)) {
    throw badRequest('INVALID_SECTION', 'This part of the profile cannot be edited.');
  }
  assertValid(validateProfileSection(section, values));
  return applyChanges(student._id, buildProfileSection(section, values));
}

/** Save the recruiter's contact and company details (pending recruiters may do this too). */
async function updateCompanyProfile(recruiter, values = {}) {
  assertValid(validateCompanyProfile(values));
  return applyChanges(recruiter._id, buildCompanyProfile(values));
}

/**
 * Upload or replace the student's resume. Nothing is written unless the file passes every check,
 * so a failed upload keeps the previous resume.
 * @param {object} student
 * @param {Buffer} data the raw request body
 * @param {{ contentType: string, fileName: string }} details
 */
async function uploadResume(student, data, { contentType, fileName }) {
  const message = validateResumeUpload(data, contentType);
  if (message) throw new AppError(400, 'INVALID_FILE', message);

  const info = { fileName: sanitizeFileName(fileName), sizeBytes: data.length, uploadedAt: new Date() };
  await Resume.findOneAndUpdate(
    { student: student._id },
    { $set: { ...info, contentType: RESUME_MIME_TYPE, data } },
    { upsert: true },
  );
  return applyChanges(student._id, { 'studentProfile.resume': info });
}

/** Remove the student's resume. Past applications keep their recorded file name (BR-17). */
async function removeResume(student) {
  if (!student.studentProfile?.resume) throw new AppError(404, 'NO_RESUME', 'There is no resume to remove.');
  await Resume.deleteOne({ student: student._id });
  return applyChanges(student._id, { 'studentProfile.resume': null });
}

/** The student's own resume file. */
async function getOwnResume(student) {
  const resume = await Resume.findOne({ student: student._id });
  if (!resume) throw new AppError(404, 'NO_RESUME', 'You have not uploaded a resume yet.');
  return { data: resume.data, fileName: resume.fileName, contentType: resume.contentType };
}

module.exports = {
  updateProfileSection, updateCompanyProfile, uploadResume, removeResume, getOwnResume,
};
