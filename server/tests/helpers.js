/**
 * helpers.js — Shared set-up for the API tests.
 * Each test file runs in its own process against a private in-memory MongoDB, so tests never
 * touch a real database. The environment is set before the app is loaded.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-0123456789';
process.env.BCRYPT_ROUNDS = '4'; // fast hashing for tests only
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.API_RATE_LIMIT_MAX = '100000';
process.env.FRONTEND_URL = 'https://freshhire-demo.netlify.app';

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { createApp } = require('../src/app');
const User = require('../src/models/user');
const { hashPassword } = require('../src/services/auth-service');
const { todayKey } = require('../src/utils/dates');

const PASSWORD = 'Passw0rd123';
const ALLOWED_ORIGIN = process.env.FRONTEND_URL;
let mongo = null;
let counter = 0;

/** Start the in-memory database and return a supertest agent for a fresh app. */
async function startApp() {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri()); // also builds the indexes (unique constraints)
  return request(createApp());
}

async function stopApp() {
  await disconnectDatabase();
  if (mongo) await mongo.stop();
}

const unique = (prefix) => `${prefix}${Date.now()}${counter += 1}`;
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** A calendar date some days from today, as "YYYY-MM-DD". */
function dateFromToday(days) {
  return todayKey(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

function studentForm(overrides = {}) {
  return {
    role: 'student',
    name: 'Test Student',
    email: `${unique('student')}@example.com`,
    phone: '9876543210',
    password: PASSWORD,
    confirmPassword: PASSWORD,
    college: 'Test College',
    degree: 'B.E.',
    branch: 'Computer Engineering',
    graduationYear: String(new Date().getFullYear()),
    cgpa: '8.5',
    ...overrides,
  };
}

function recruiterForm(overrides = {}) {
  return {
    role: 'recruiter',
    name: 'Test Recruiter',
    email: `${unique('recruiter')}@example.com`,
    phone: '9876543211',
    password: PASSWORD,
    confirmPassword: PASSWORD,
    companyName: 'Test Company',
    designation: 'HR Manager',
    companyWebsite: 'https://example.com',
    companyLocation: 'Pune',
    ...overrides,
  };
}

function jobForm(overrides = {}) {
  return {
    title: 'Junior Developer',
    location: 'Pune',
    jobType: 'full-time',
    workMode: 'hybrid',
    experience: 'Fresher',
    openings: '2',
    deadline: dateFromToday(30),
    salaryPeriod: 'year',
    salaryMin: '300000',
    salaryMax: '450000',
    description: 'Build and test web features.',
    responsibilities: ['Write code', 'Fix bugs'],
    skills: ['JavaScript', 'HTML'],
    degrees: [],
    graduationYears: [],
    minCgpa: '',
    ...overrides,
  };
}

async function login(api, email, password = PASSWORD) {
  const response = await api.post('/api/auth/login').send({ email, password });
  if (response.status !== 200) throw new Error(`login failed for ${email}: ${response.status}`);
  return response.body.data;
}

/** Register a student through the API and log in. @returns {{ token, user, email }} */
async function createStudent(api, overrides = {}) {
  const form = studentForm(overrides);
  const response = await api.post('/api/auth/register').send(form);
  if (response.status !== 201) throw new Error(`student registration failed: ${JSON.stringify(response.body)}`);
  return { ...(await login(api, form.email)), email: form.email };
}

/** Create an admin directly in the database (admins can never register) and log in. */
async function createAdmin(api) {
  const email = `${unique('admin')}@example.com`;
  await User.create({
    role: 'admin', name: 'Test Admin', email, passwordHash: await hashPassword(PASSWORD), status: 'active',
  });
  return { ...(await login(api, email)), email };
}

/** Register a recruiter through the API; `approvedBy` (an admin session) makes the account active. */
async function createRecruiter(api, { approvedBy = null, ...overrides } = {}) {
  const form = recruiterForm(overrides);
  const response = await api.post('/api/auth/register').send(form);
  if (response.status !== 201) throw new Error(`recruiter registration failed: ${JSON.stringify(response.body)}`);
  if (approvedBy) {
    const approval = await api.post(`/api/admin/users/${response.body.data.user.id}/approve`).set(bearer(approvedBy.token));
    if (approval.status !== 200) throw new Error(`recruiter approval failed: ${approval.status}`);
  }
  return { ...(await login(api, form.email)), email: form.email };
}

/** Post a job as the recruiter; `approvedBy` (an admin session) makes it visible to students. */
async function createJob(api, recruiter, { approvedBy = null, ...overrides } = {}) {
  const response = await api.post('/api/recruiter/jobs').set(bearer(recruiter.token)).send(jobForm(overrides));
  if (response.status !== 201) throw new Error(`job creation failed: ${JSON.stringify(response.body)}`);
  const job = response.body.data;
  if (approvedBy) {
    const approval = await api.post(`/api/admin/jobs/${job.id}/approve`).set(bearer(approvedBy.token));
    if (approval.status !== 200) throw new Error(`job approval failed: ${approval.status}`);
    return approval.body.data;
  }
  return job;
}

/** A small but valid-looking PDF of the given size in bytes. */
function pdfOfSize(size) {
  const buffer = Buffer.alloc(size, 0x20);
  buffer.write('%PDF-1.4\n');
  return buffer;
}

module.exports = {
  PASSWORD,
  ALLOWED_ORIGIN,
  startApp,
  stopApp,
  unique,
  bearer,
  dateFromToday,
  studentForm,
  recruiterForm,
  jobForm,
  login,
  createStudent,
  createAdmin,
  createRecruiter,
  createJob,
  pdfOfSize,
};
