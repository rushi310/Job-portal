/**
 * auth.test.js — Registration, login, logout / session expiry, password storage, rate limiting.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const {
  startApp, stopApp, bearer, studentForm, recruiterForm, createStudent, createAdmin, PASSWORD,
} = require('./helpers');
const User = require('../src/models/user');
const { createApp } = require('../src/app');
const { createAuthLimiter } = require('../src/middleware/rate-limiters');

describe('authentication API', () => {
  let api;
  before(async () => { api = await startApp(); });
  after(stopApp);

  describe('registration', () => {
    it('creates an active student and never returns or stores the plain password', async () => {
      const form = studentForm();
      const response = await api.post('/api/auth/register').send(form);
      assert.equal(response.status, 201);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.data.user.role, 'student');
      assert.equal(response.body.data.user.status, 'active');
      assert.equal(JSON.stringify(response.body).includes(PASSWORD), false);
      assert.equal('passwordHash' in response.body.data.user, false);
      assert.equal('token' in response.body.data, false, 'registration does not log the user in');

      const stored = await User.findOne({ email: form.email }).select('+passwordHash');
      assert.notEqual(stored.passwordHash, PASSWORD);
      assert.match(stored.passwordHash, /^\$2[aby]\$/, 'a bcrypt hash is stored');
    });

    it('creates a recruiter as pending', async () => {
      const response = await api.post('/api/auth/register').send(recruiterForm());
      assert.equal(response.status, 201);
      assert.equal(response.body.data.user.status, 'pending');
      assert.equal(response.body.data.isPendingApproval, true);
    });

    it('rejects a duplicate email, ignoring case and spaces', async () => {
      const form = studentForm();
      await api.post('/api/auth/register').send(form);
      const response = await api.post('/api/auth/register').send(studentForm({ email: `  ${form.email.toUpperCase()} ` }));
      assert.equal(response.status, 400);
      assert.equal(response.body.code, 'VALIDATION_FAILED');
      assert.ok(response.body.fieldErrors.email);
      assert.equal(await User.countDocuments({ email: form.email }), 1);
    });

    it('never creates an admin, whatever the request says', async () => {
      const asAdmin = await api.post('/api/auth/register').send(studentForm({ role: 'admin' }));
      assert.equal(asAdmin.status, 400);
      assert.equal(asAdmin.body.code, 'ROLE_NOT_ALLOWED');

      // A student form with extra fields trying to raise privileges or skip approval.
      const form = recruiterForm({ status: 'active', isAdmin: true, tokenVersion: 99 });
      const response = await api.post('/api/auth/register').send(form);
      assert.equal(response.status, 201);
      const stored = await User.findOne({ email: form.email });
      assert.equal(stored.role, 'recruiter');
      assert.equal(stored.status, 'pending', 'status cannot be injected');
      assert.equal(await User.countDocuments({ role: 'admin', email: form.email }), 0);
    });

    it('validates fields (weak password, bad email, mismatch)', async () => {
      const response = await api.post('/api/auth/register').send(studentForm({
        email: 'not-an-email', password: 'weak', confirmPassword: 'different', phone: '123',
      }));
      assert.equal(response.status, 400);
      assert.deepEqual(Object.keys(response.body.fieldErrors).sort(), ['confirmPassword', 'email', 'password', 'phone']);
    });
  });

  describe('login', () => {
    it('logs in with a valid password and returns a token without any hash', async () => {
      const form = studentForm();
      await api.post('/api/auth/register').send(form);
      const response = await api.post('/api/auth/login').send({ email: form.email.toUpperCase(), password: PASSWORD });
      assert.equal(response.status, 200);
      assert.equal(typeof response.body.data.token, 'string');
      assert.equal(response.body.data.user.email, form.email);
      assert.equal(JSON.stringify(response.body).includes('passwordHash'), false);
      assert.equal(JSON.stringify(response.body).includes('$2'), false);
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const form = studentForm();
      await api.post('/api/auth/register').send(form);
      const wrong = await api.post('/api/auth/login').send({ email: form.email, password: 'Wrong12345' });
      const unknown = await api.post('/api/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });
      assert.equal(wrong.status, 401);
      assert.equal(unknown.status, 401);
      assert.deepEqual(wrong.body, unknown.body);
      assert.equal(wrong.body.code, 'INVALID_CREDENTIALS');
    });

    it('refuses objects in place of the email or password (no query injection)', async () => {
      const response = await api.post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
      assert.equal(response.status, 400);
      assert.equal(response.body.code, 'MISSING_FIELDS');
    });

    it('refuses a blocked account', async () => {
      const student = await createStudent(api);
      await User.updateOne({ email: student.email }, { status: 'blocked' });
      const response = await api.post('/api/auth/login').send({ email: student.email, password: PASSWORD });
      assert.equal(response.status, 403);
      assert.equal(response.body.code, 'ACCOUNT_BLOCKED');
    });
  });

  describe('sessions', () => {
    it('returns the current user for a valid token', async () => {
      const student = await createStudent(api);
      const response = await api.get('/api/auth/me').set(bearer(student.token));
      assert.equal(response.status, 200);
      assert.equal(response.body.data.user.id, student.user.id);
      assert.equal(response.body.data.unreadCount, 0);
    });

    it('denies requests without a token, with a malformed token or with a foreign signature', async () => {
      const student = await createStudent(api);
      const forged = jwt.sign({ sub: student.user.id, role: 'student', tv: 0 }, 'some-other-secret');
      for (const headers of [{}, { Authorization: 'Bearer nonsense' }, bearer(forged)]) {
        const response = await api.get('/api/auth/me').set(headers);
        assert.equal(response.status, 401);
        assert.equal(response.body.code, 'UNAUTHENTICATED');
      }
    });

    it('denies an expired token', async () => {
      const student = await createStudent(api);
      const expired = jwt.sign({ sub: student.user.id, role: 'student', tv: 0 }, process.env.JWT_SECRET, { expiresIn: -10 });
      const response = await api.get('/api/auth/me').set(bearer(expired));
      assert.equal(response.status, 401);
    });

    it('logout makes the token stop working', async () => {
      const student = await createStudent(api);
      assert.equal((await api.post('/api/auth/logout').set(bearer(student.token))).status, 200);
      assert.equal((await api.get('/api/auth/me').set(bearer(student.token))).status, 401);
      // Logging in again works and gives a usable token.
      const again = await api.post('/api/auth/login').send({ email: student.email, password: PASSWORD });
      assert.equal((await api.get('/api/auth/me').set(bearer(again.body.data.token))).status, 200);
    });

    it('ends an open session when the account is blocked or deleted', async () => {
      const blocked = await createStudent(api);
      await User.updateOne({ email: blocked.email }, { status: 'blocked' });
      assert.equal((await api.get('/api/auth/me').set(bearer(blocked.token))).status, 401);

      const deleted = await createStudent(api);
      await User.deleteOne({ email: deleted.email });
      assert.equal((await api.get('/api/auth/me').set(bearer(deleted.token))).status, 401);
    });

    it('does not trust the role written in a token', async () => {
      const student = await createStudent(api);
      // Even a correctly signed token is refused when its role differs from the account's role.
      const lying = jwt.sign({ sub: student.user.id, role: 'admin', tv: 0 }, process.env.JWT_SECRET, { expiresIn: 60 });
      assert.equal((await api.get('/api/admin/dashboard').set(bearer(lying))).status, 401);
      const admin = await createAdmin(api);
      assert.equal((await api.get('/api/admin/dashboard').set(bearer(admin.token))).status, 200);
    });
  });

  describe('login rate limiting', () => {
    it('is applied to the login route', async () => {
      const response = await api.post('/api/auth/login').send({ email: 'a@example.com', password: 'x' });
      assert.ok(response.headers['ratelimit-limit'], 'rate-limit headers are present on login');
    });

    it('does not count successful logins, so normal use is never locked out', async () => {
      const limited = express();
      limited.use('/api/auth/login', createAuthLimiter(2, { failedOnly: true }));
      limited.use(createApp());
      const client = request(limited);
      const student = await createStudent(api);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await client.post('/api/auth/login').send({ email: student.email, password: PASSWORD });
        assert.equal(response.status, 200, `successful login ${attempt + 1}`);
      }
    });

    it('answers 429 in the standard error format once the limit of failed attempts is reached', async () => {
      const limited = express();
      limited.use('/api/auth/login', createAuthLimiter(2, { failedOnly: true }));
      limited.use(createApp());
      const client = request(limited);
      const attempt = () => client.post('/api/auth/login').send({ email: 'a@example.com', password: 'Wrong12345' });
      assert.equal((await attempt()).status, 401);
      assert.equal((await attempt()).status, 401);
      const blocked = await attempt();
      assert.equal(blocked.status, 429);
      assert.deepEqual(Object.keys(blocked.body).sort(), ['code', 'error', 'ok']);
      assert.equal(blocked.body.code, 'RATE_LIMITED');
    });
  });
});
