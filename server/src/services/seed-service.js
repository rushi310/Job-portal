/**
 * seed-service.js — Imports the demo data in /data/*.json into MongoDB.
 * Safe to run more than once: every record is matched by its original id (or email, for users)
 * and is created only when it is missing. Existing records — including passwords — are never
 * changed or deleted. Plain-text passwords in the JSON files are hashed with bcrypt before they
 * are stored; nothing about them is printed.
 */

const fs = require('fs');
const path = require('path');
const User = require('../models/user');
const Job = require('../models/job');
const Application = require('../models/application');
const Notification = require('../models/notification');
const { ROLES } = require('../config/constants');
const { normalizeEmail } = require('../utils/text');
const { hashPassword } = require('./auth-service');

const DATA_DIR = path.join(__dirname, '../../../data');
const SEED_FILES = ['users', 'jobs', 'applications', 'notifications'];
const DUPLICATE_KEY = 11000;

function readSeedFile(name) {
  let records;
  try {
    records = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), 'utf8'));
  } catch (error) {
    throw new Error(`Could not read data/${name}.json (${error.code ?? error.name}).`);
  }
  if (!Array.isArray(records)) throw new Error(`data/${name}.json must contain a JSON array`);
  return records;
}

/**
 * Read every seed file. Callers that delete data first (the admin demo reset) load the files
 * before deleting anything, so a missing or broken file can never leave the database empty.
 * @returns {{ users: Array, jobs: Array, applications: Array, notifications: Array }}
 */
function loadSeedData() {
  return Object.fromEntries(SEED_FILES.map((name) => [name, readSeedFile(name)]));
}

const newSummary = () => ({ created: 0, existing: 0, skipped: 0 });

/**
 * Create a document unless one with this legacy id already exists.
 * @returns {Promise<object|null>} the existing or new document; null when it had to be skipped
 */
async function createIfMissing(Model, legacyId, build, summary) {
  const existing = await Model.findOne({ legacyId });
  if (existing) {
    summary.existing += 1;
    return existing;
  }
  const fields = build();
  if (!fields) {
    summary.skipped += 1; // a record it depends on is missing
    return null;
  }
  try {
    const created = await Model.create({ ...fields, legacyId });
    summary.created += 1;
    return created;
  } catch (error) {
    if (error.code !== DUPLICATE_KEY) throw error;
    summary.skipped += 1; // e.g. the student already applied to this job through the app
    return null;
  }
}

function buildUserFields(record, passwordHash) {
  const isStudent = record.role === ROLES.STUDENT;
  const isRecruiter = record.role === ROLES.RECRUITER;
  // The resume file is not part of the seed data, so a seeded profile starts without one.
  const { resume, ...studentProfile } = isStudent ? (record.profile ?? {}) : {};
  return {
    role: record.role,
    name: record.name,
    email: normalizeEmail(record.email),
    passwordHash,
    phone: record.phone ?? '',
    status: record.status,
    studentProfile: isStudent ? studentProfile : undefined,
    recruiterProfile: isRecruiter ? (record.profile ?? {}) : undefined,
    createdAt: record.createdAt,
  };
}

/**
 * Import users. An account that already exists (same email or legacy id) is left exactly as it is.
 * @param {{ adminPassword?: string, skipAdmins?: boolean }} options
 * @returns {Promise<Map<string, *>>} legacy id → database id
 */
async function seedUsers(records, summary, { adminPassword, skipAdmins }) {
  const ids = new Map();
  for (const record of records) {
    const existing = await User.findOne({ $or: [{ legacyId: record.id }, { email: normalizeEmail(record.email) }] });
    if (existing) {
      summary.existing += 1;
      ids.set(record.id, existing._id);
    } else if (record.role === ROLES.ADMIN && skipAdmins) {
      summary.skipped += 1;
    } else {
      const password = record.role === ROLES.ADMIN && adminPassword ? adminPassword : record.password;
      const user = await User.create({ ...buildUserFields(record, await hashPassword(password)), legacyId: record.id });
      summary.created += 1;
      ids.set(record.id, user._id);
    }
  }
  return ids;
}

async function seedJobs(records, summary, userIds) {
  const ids = new Map();
  for (const record of records) {
    const { id, recruiterId, ...fields } = record;
    const job = await createIfMissing(Job, id, () => (
      userIds.has(recruiterId) ? { ...fields, recruiter: userIds.get(recruiterId) } : null
    ), summary);
    if (job) ids.set(id, job._id);
  }
  return ids;
}

async function seedApplications(records, summary, userIds, jobIds) {
  for (const record of records) {
    const { id, jobId, studentId, recruiterId, ...fields } = record; // the recruiter is found through the job
    await createIfMissing(Application, id, () => (
      userIds.has(studentId) && jobIds.has(jobId)
        ? { ...fields, job: jobIds.get(jobId), student: userIds.get(studentId) } : null
    ), summary);
  }
}

async function seedNotifications(records, summary, userIds) {
  for (const record of records) {
    const { id, userId, ...fields } = record;
    await createIfMissing(Notification, id, () => (
      userIds.has(userId) ? { ...fields, user: userIds.get(userId) } : null
    ), summary);
  }
}

/**
 * Import the demo data, keeping the relationships between users, jobs, applications and
 * notifications. Never deletes or overwrites anything.
 * @param {{ adminPassword?: string, skipAdmins?: boolean }} [options]
 *   adminPassword — password for a newly created admin instead of the public demo one;
 *   skipAdmins — do not create admin accounts at all
 * @param {object} [data] seed records from loadSeedData() (read now when not given)
 * @returns {Promise<Object<string, { created: number, existing: number, skipped: number }>>}
 */
async function seedDatabase(options = {}, data = loadSeedData()) {
  const summary = Object.fromEntries(SEED_FILES.map((name) => [name, newSummary()]));
  const userIds = await seedUsers(data.users, summary.users, options);
  const jobIds = await seedJobs(data.jobs, summary.jobs, userIds);
  await seedApplications(data.applications, summary.applications, userIds, jobIds);
  await seedNotifications(data.notifications, summary.notifications, userIds);
  return summary;
}

module.exports = { seedDatabase, loadSeedData };
