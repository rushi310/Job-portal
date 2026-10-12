/**
 * user.js — User accounts (PROJECT_SPEC.md §5.1).
 * Student profile data and recruiter / company profile data are embedded sub-documents: they are
 * always read with their user and never shared. The password is stored only as a bcrypt hash and
 * is excluded from every query unless explicitly selected.
 */

const { Schema, model } = require('mongoose');
const { ROLES, USER_STATUS } = require('../config/constants');

const educationSchema = new Schema({
  level: { type: String, default: '' },
  institute: { type: String, default: '' },
  year: { type: Number },
  score: { type: String, default: '' },
}, { _id: false });

const projectSchema = new Schema({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  link: { type: String, default: '' },
}, { _id: false });

/** Details of the uploaded resume; the file itself is in the Resume collection. */
const resumeInfoSchema = new Schema({
  fileName: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  uploadedAt: { type: Date, required: true },
}, { _id: false });

const studentProfileSchema = new Schema({
  college: { type: String, default: '' },
  degree: { type: String, default: '' },
  branch: { type: String, default: '' },
  graduationYear: { type: Number, default: null },
  cgpa: { type: Number, default: null },
  location: { type: String, default: '' },
  about: { type: String, default: '' },
  skills: { type: [String], default: [] },
  education: { type: [educationSchema], default: [] },
  projects: { type: [projectSchema], default: [] },
  links: {
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    portfolio: { type: String, default: '' },
  },
  resume: { type: resumeInfoSchema, default: null },
}, { _id: false });

const recruiterProfileSchema = new Schema({
  companyName: { type: String, default: '' },
  designation: { type: String, default: '' },
  companyWebsite: { type: String, default: '' },
  companyLocation: { type: String, default: '' },
  companySize: { type: String, default: '' },
  industry: { type: String, default: '' },
  about: { type: String, default: '' },
}, { _id: false });

const userSchema = new Schema({
  role: { type: String, enum: Object.values(ROLES), required: true },
  name: { type: String, required: true, trim: true },
  // Stored trimmed and lower-cased, so the unique index enforces BR-01 (case-insensitive).
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  phone: { type: String, default: '' },
  status: { type: String, enum: Object.values(USER_STATUS), required: true },
  // Increased on logout: tokens issued before that are refused.
  tokenVersion: { type: Number, default: 0 },
  studentProfile: { type: studentProfileSchema, default: undefined },
  recruiterProfile: { type: recruiterProfileSchema, default: undefined },
  // Id from the original JSON seed files; lets the seed script run again without duplicates.
  legacyId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
});

userSchema.index({ role: 1, status: 1, createdAt: -1 });

module.exports = model('User', userSchema);
