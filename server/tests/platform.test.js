/**
 * platform.test.js — Notifications, admin workflows, analytics, the seed script's import, and
 * deployment readiness (health check, CORS, error format, no secrets in responses).
 */

process.env.ALLOW_DEMO_RESET = 'true';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {
  startApp, stopApp, bearer, ALLOWED_ORIGIN, createStudent, createAdmin, createRecruiter, createJob, login, PASSWORD,
} = require('./helpers');
const User = require('../src/models/user');
const Job = require('../src/models/job');
const Application = require('../src/models/application');
const SavedJob = require('../src/models/saved-job');
const Notification = require('../src/models/notification');
const { seedDatabase } = require('../src/services/seed-service');
const { groupByPeriod, toPercent, getStatusFunnel } = require('../src/services/analytics-service');
const { loadConfig } = require('../src/config/env');

const readSeed = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../data', `${name}.json`), 'utf8'));

describe('platform API', () => {
  let api;
  let admin;
  before(async () => {
    api = await startApp();
    admin = await createAdmin(api);
  });
  after(stopApp);

  describe('notifications', () => {
    it('belong to one user: lists, unread count and mark-as-read are isolated', async () => {
      const studentA = await createStudent(api);
      const studentB = await createStudent(api);
      const sent = await api.post('/api/admin/announcements').set(bearer(admin.token))
        .send({ audience: 'students', title: ' Welcome ', message: 'Hello students' });
      assert.equal(sent.status, 201);

      const listA = (await api.get('/api/notifications').set(bearer(studentA.token))).body.data;
      assert.equal(listA.items.length, 1);
      assert.deepEqual([listA.items[0].title, listA.items[0].type, listA.items[0].read], ['Welcome', 'announcement', false]);
      assert.equal(listA.unread, 1);
      assert.equal(listA.items[0].userId, studentA.user.id);
      assert.equal((await api.get('/api/auth/me').set(bearer(studentA.token))).body.data.unreadCount, 1);

      // Student B cannot mark student A's notification; it looks like an unknown id.
      const foreign = await api.post(`/api/notifications/${listA.items[0].id}/read`).set(bearer(studentB.token));
      assert.equal(foreign.status, 404);
      assert.equal((await Notification.findById(listA.items[0].id)).read, false);

      const marked = await api.post(`/api/notifications/${listA.items[0].id}/read`).set(bearer(studentA.token));
      assert.deepEqual(marked.body.data, { changed: 1, unread: 0 });
      assert.equal((await api.post(`/api/notifications/${listA.items[0].id}/read`).set(bearer(studentA.token))).body.data.changed, 0);
      assert.equal((await api.get('/api/notifications/unread-count').set(bearer(studentB.token))).body.data.unread, 1);

      const all = await api.post('/api/notifications/read-all').set(bearer(studentB.token));
      assert.equal(all.body.data.changed, 1);
      assert.equal(await Notification.countDocuments({ user: studentB.user.id, read: false }), 0);
      assert.equal((await api.get('/api/notifications?userId=' + studentA.user.id).set(bearer(studentB.token)))
        .body.data.items.every((item) => item.userId === studentB.user.id), true);
    });

    it('are created by events, not by reading pages', async () => {
      const recruiter = await createRecruiter(api, { approvedBy: admin });
      const count = () => Notification.countDocuments({ user: recruiter.user.id });
      assert.equal(await count(), 1, '"Account approved"');
      const job = await createJob(api, recruiter, { approvedBy: admin });
      assert.equal(await count(), 2, '"Job approved"');
      for (let i = 0; i < 3; i += 1) {
        await api.get('/api/notifications').set(bearer(recruiter.token));
        await api.get('/api/recruiter/dashboard').set(bearer(recruiter.token));
      }
      assert.equal(await count(), 2);
      // A refused action creates nothing.
      await api.post(`/api/admin/jobs/${job.id}/approve`).set(bearer(admin.token));
      assert.equal(await count(), 2);
    });

    it('announcements validate input, skip blocked accounts and are listed for the admin', async () => {
      const headers = bearer(admin.token);
      const invalid = await api.post('/api/admin/announcements').set(headers).send({ audience: 'everyone', title: '', message: 'x'.repeat(501) });
      assert.deepEqual(Object.keys(invalid.body.fieldErrors).sort(), ['audience', 'message', 'title']);

      const blocked = await createRecruiter(api, { approvedBy: admin });
      await api.post(`/api/admin/users/${blocked.user.id}/block`).set(headers);
      const before = await Notification.countDocuments({ user: blocked.user.id });
      const sent = await api.post('/api/admin/announcements').set(headers).send({ audience: 'recruiters', title: 'Recruiter news', message: 'Hi' });
      assert.equal(sent.body.data.recipients, await User.countDocuments({ role: 'recruiter', status: { $ne: 'blocked' } }));
      assert.equal(await Notification.countDocuments({ user: blocked.user.id }), before);

      const list = (await api.get('/api/admin/announcements').set(headers)).body.data.items;
      assert.deepEqual([list[0].title, list[0].audience, list[0].recipients], ['Recruiter news', 'recruiters', sent.body.data.recipients]);
    });
  });

  describe('admin user management', () => {
    it('lists, searches and filters users without exposing password data', async () => {
      await createRecruiter(api, { name: 'Findable Person', companyName: 'Quasar Systems' });
      const headers = bearer(admin.token);
      const byCompany = await api.get('/api/admin/users?query=quasar').set(headers);
      assert.equal(byCompany.body.data.total, 1);
      assert.equal(byCompany.body.data.items[0].companyName, 'Quasar Systems');
      assert.deepEqual(byCompany.body.data.items[0].actions, { approve: true, block: false, unblock: false, remove: true });
      const pending = await api.get('/api/admin/users?role=recruiter&status=pending').set(headers);
      assert.equal(pending.body.data.items.every((user) => user.role === 'recruiter' && user.status === 'pending'), true);
      const everyone = await api.get('/api/admin/users?limit=100').set(headers);
      assert.equal(JSON.stringify(everyone.body).includes('password'), false);
      const paged = await api.get('/api/admin/users?limit=2&page=2').set(headers);
      assert.deepEqual([paged.body.data.items.length, paged.body.data.page, paged.body.data.from], [2, 2, 3]);
    });

    it('approves, blocks and unblocks with validated transitions; admins are untouchable', async () => {
      const headers = bearer(admin.token);
      const recruiter = await createRecruiter(api);
      const url = (action) => `/api/admin/users/${recruiter.user.id}/${action}`;
      assert.equal((await api.post(url('block')).set(headers)).status, 409, 'pending accounts are not blocked');
      assert.equal((await api.post(url('unblock')).set(headers)).status, 409);
      assert.equal((await api.post(url('approve')).set(headers)).body.data.status, 'active');
      assert.equal((await api.post(url('approve')).set(headers)).status, 409, 'cannot approve twice');
      assert.equal((await api.post(url('block')).set(headers)).body.data.status, 'blocked');
      assert.equal((await api.get('/api/recruiter/dashboard').set(bearer(recruiter.token))).status, 401, 'open session ends');
      assert.equal((await api.post('/api/auth/login').send({ email: recruiter.email, password: PASSWORD })).status, 403);
      assert.equal((await api.post(url('unblock')).set(headers)).body.data.status, 'active');
      assert.equal((await login(api, recruiter.email)).user.status, 'active');

      const otherAdmin = await createAdmin(api);
      for (const target of [admin.user.id, otherAdmin.user.id]) {
        assert.equal((await api.post(`/api/admin/users/${target}/block`).set(headers)).status, 409);
        assert.equal((await api.delete(`/api/admin/users/${target}`).set(headers)).status, 409);
      }
      assert.equal(await User.countDocuments({ role: 'admin' }), 2);
      assert.equal((await api.post('/api/admin/users/64b000000000000000000000/approve').set(headers)).status, 404);
    });

    it('deletes a recruiter with their jobs and related records, leaving other data alone', async () => {
      const headers = bearer(admin.token);
      const doomed = await createRecruiter(api, { approvedBy: admin });
      const keeper = await createRecruiter(api, { approvedBy: admin });
      const student = await createStudent(api);
      const doomedJob = await createJob(api, doomed, { approvedBy: admin });
      const keptJob = await createJob(api, keeper, { approvedBy: admin });
      for (const job of [doomedJob, keptJob]) {
        await api.post(`/api/jobs/${job.id}/applications`).set(bearer(student.token)).send({});
        await api.put(`/api/student/saved-jobs/${job.id}`).set(bearer(student.token));
      }

      const response = await api.delete(`/api/admin/users/${doomed.user.id}`).set(headers);
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data.removed, { jobs: 1, applications: 1, savedJobs: 1 });
      assert.equal(await User.countDocuments({ _id: doomed.user.id }), 0);
      assert.equal(await Job.countDocuments({ recruiter: doomed.user.id }), 0);
      assert.equal(await Notification.countDocuments({ user: doomed.user.id }), 0);
      assert.equal(await Application.countDocuments({ student: student.user.id }), 1);
      assert.equal(await SavedJob.countDocuments({ student: student.user.id }), 1);
      assert.equal(await Job.countDocuments({ _id: keptJob.id }), 1);
      assert.equal((await api.get('/api/recruiter/jobs').set(bearer(doomed.token))).status, 401);
      assert.equal((await api.post('/api/auth/login').send({ email: doomed.email, password: PASSWORD })).status, 401);
    });
  });

  describe('analytics', () => {
    it('calculates safely on empty data', () => {
      assert.equal(toPercent(0, 0), 0);
      assert.equal(toPercent(1, 3), 33);
      assert.deepEqual(groupByPeriod([]), { unit: 'week', total: 0, invalid: 0, points: [] });
      assert.equal(getStatusFunnel([]).stages.every((stage) => stage.count === 0 && stage.percent === 0), true);
    });

    it('groups dates by week, then by month for long ranges, and sets aside unusable dates', () => {
      const now = new Date('2026-10-12T10:00:00.000Z');
      const recent = groupByPeriod([new Date('2026-10-05T10:00:00.000Z'), new Date('2026-10-12T05:00:00.000Z'), new Date('2030-01-01'), null], now);
      assert.equal(recent.unit, 'week');
      assert.equal(recent.invalid, 2, 'a future date and a missing date');
      assert.deepEqual(recent.points, [{ key: '2026-10-05', count: 1 }, { key: '2026-10-12', count: 1 }]);
      const long = groupByPeriod([new Date('2026-01-15T10:00:00.000Z'), new Date('2026-10-01T10:00:00.000Z')], now);
      assert.equal(long.unit, 'month');
      assert.equal(long.points.length, 10);
      assert.equal(long.points.reduce((sum, point) => sum + point.count, 0), 2);
    });

    it('gives each recruiter only their own numbers, and the admin report matches the database', async () => {
      const recruiterA = await createRecruiter(api, { approvedBy: admin });
      const recruiterB = await createRecruiter(api, { approvedBy: admin });
      const student = await createStudent(api);
      const jobA = await createJob(api, recruiterA, { approvedBy: admin, title: 'Analytics A' });
      await createJob(api, recruiterB, { approvedBy: admin, title: 'Analytics B' });
      const application = await api.post(`/api/jobs/${jobA.id}/applications`).set(bearer(student.token)).send({});
      const statusUrl = `/api/recruiter/applications/${application.body.data.id}/status`;
      await api.patch(statusUrl).set(bearer(recruiterA.token)).send({ status: 'under_review' });
      await api.patch(statusUrl).set(bearer(recruiterA.token)).send({ status: 'rejected' });

      const a = (await api.get('/api/recruiter/dashboard').set(bearer(recruiterA.token))).body.data;
      assert.equal(a.stats.totalApplicants, 1);
      assert.equal(a.stats.activeJobs, 1);
      assert.deepEqual(a.analytics.jobs.map((job) => [job.title, job.count]), [['Analytics A', 1]]);
      assert.deepEqual(a.analytics.funnel.stages.map((stage) => stage.count), [1, 1, 0, 0, 0], 'rejected after review');
      assert.equal(a.recentApplicants[0].jobTitle, 'Analytics A');

      const b = (await api.get('/api/recruiter/dashboard').set(bearer(recruiterB.token))).body.data;
      assert.equal(b.stats.totalApplicants, 0);
      assert.deepEqual(b.analytics.jobs.map((job) => job.title), ['Analytics B']);
      assert.equal(b.analytics.funnel.total, 0);
      assert.equal(b.recentApplicants.length, 0);

      const report = (await api.get('/api/admin/reports').set(bearer(admin.token))).body.data;
      const dashboard = (await api.get('/api/admin/dashboard').set(bearer(admin.token))).body.data;
      assert.equal(report.usersByRole.total, await User.countDocuments());
      assert.equal(report.jobsByStatus.total, await Job.countDocuments());
      assert.equal(report.applicationsByStatus.total, await Application.countDocuments());
      assert.equal(report.applicationsOverTime.total + report.applicationsOverTime.invalid, await Application.countDocuments());
      assert.equal(dashboard.stats.jobs, report.jobsByStatus.total);
      assert.equal(dashboard.stats.applications, report.applicationsByStatus.total);
      assert.equal(dashboard.stats.students, report.usersByRole.items.find((item) => item.key === 'student').count);
      // Totals sent by a client are simply not accepted anywhere.
      const spoof = await api.get('/api/admin/reports?total=999&count=999').set(bearer(admin.token));
      assert.equal(spoof.body.data.usersByRole.total, report.usersByRole.total);
    });
  });

  describe('seed import and demo reset', () => {
    it('imports the JSON data with hashed passwords and intact relationships, and is repeatable', async () => {
      const users = readSeed('users');
      const first = await seedDatabase({ adminPassword: 'Custom-Admin-Passw0rd' });
      assert.equal(first.users.created, users.length);
      assert.equal(first.jobs.created, readSeed('jobs').length);
      assert.equal(first.applications.created, readSeed('applications').length);
      assert.equal(first.notifications.created, readSeed('notifications').length);

      const stored = await User.find({ legacyId: { $exists: true } }).select('+passwordHash');
      assert.equal(stored.every((user) => /^\$2[aby]\$/.test(user.passwordHash)), true, 'every password is a bcrypt hash');
      const seedPasswords = users.map((user) => user.password);
      assert.equal(stored.some((user) => seedPasswords.includes(user.passwordHash)), false);

      const seedAdmin = stored.find((user) => user.role === 'admin');
      assert.equal(await bcrypt.compare('Custom-Admin-Passw0rd', seedAdmin.passwordHash), true);
      assert.equal(await bcrypt.compare(users.find((user) => user.role === 'admin').password, seedAdmin.passwordHash), false);

      // Relationships: a seeded application points at the right student and job.
      const seedApplication = readSeed('applications')[0];
      const application = await Application.findOne({ legacyId: seedApplication.id }).populate('job student');
      assert.equal(application.job.legacyId, seedApplication.jobId);
      assert.equal(application.student.legacyId, seedApplication.studentId);
      assert.equal(String(application.job.recruiter), String((await User.findOne({ legacyId: seedApplication.recruiterId }))._id));

      // The demo accounts work through the API; blocked stays blocked, pending stays pending.
      const demoStudent = users.find((user) => user.email === 'student@freshhire.com');
      assert.equal((await login(api, demoStudent.email, demoStudent.password)).user.role, 'student');
      assert.equal((await User.findOne({ legacyId: 'usr_rec04' })).status, 'pending');
      assert.equal((await User.findOne({ legacyId: 'usr_rec05' })).status, 'blocked');

      // Second run: nothing new, nothing overwritten (a changed password and name survive).
      await User.updateOne({ legacyId: demoStudent.id }, { name: 'Renamed By User' });
      const hashBefore = (await User.findOne({ legacyId: demoStudent.id }).select('+passwordHash')).passwordHash;
      const counts = await Promise.all([User, Job, Application, Notification].map((model) => model.countDocuments()));
      const second = await seedDatabase();
      assert.deepEqual([second.users.created, second.jobs.created, second.applications.created, second.notifications.created], [0, 0, 0, 0]);
      assert.deepEqual(await Promise.all([User, Job, Application, Notification].map((model) => model.countDocuments())), counts);
      const after = await User.findOne({ legacyId: demoStudent.id }).select('+passwordHash');
      assert.equal(after.name, 'Renamed By User');
      assert.equal(after.passwordHash, hashBefore);
    });

    it('reset is admin-only, keeps admin accounts and restores the demo data', async () => {
      const student = await createStudent(api);
      assert.equal((await api.post('/api/admin/reset-demo-data').set(bearer(student.token))).status, 403);
      const adminCount = await User.countDocuments({ role: 'admin' });

      const response = await api.post('/api/admin/reset-demo-data').set(bearer(admin.token));
      assert.equal(response.status, 200);
      assert.equal(await User.countDocuments({ role: 'admin' }), adminCount);
      assert.equal(await User.countDocuments({ _id: student.user.id }), 0);
      assert.equal(await Job.countDocuments(), readSeed('jobs').length);
      assert.equal(await SavedJob.countDocuments(), 0);
      assert.equal((await api.get('/api/admin/dashboard').set(bearer(admin.token))).status, 200, 'the admin stays logged in');
    });
  });

  describe('deployment readiness', () => {
    it('reports health, and 503 when the database is down', async () => {
      const healthy = await api.get('/api/health');
      assert.deepEqual([healthy.status, healthy.body.data.database], [200, 'connected']);

      const uri = mongoose.connection.client.s.url;
      await mongoose.disconnect();
      const down = await api.get('/api/health');
      assert.deepEqual([down.status, down.body.ok, down.body.data.database], [503, false, 'disconnected']);
      const landing = await api.get('/api/public/landing');
      assert.equal(landing.status, 503);
      assert.equal(landing.body.code, 'SERVICE_UNAVAILABLE');
      assert.equal(JSON.stringify(landing.body).includes('mongodb'), false, 'no connection details in the error');
      await mongoose.connect(uri);
      assert.equal((await api.get('/api/health')).status, 200);
    });

    it('allows only the configured frontend origin (no wildcard, no credentials)', async () => {
      const allowed = await api.get('/api/health').set('Origin', ALLOWED_ORIGIN);
      assert.equal(allowed.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
      assert.equal(allowed.headers['access-control-allow-credentials'], undefined);

      const preflight = await api.options('/api/auth/login').set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type,authorization');
      assert.equal(preflight.status, 204);
      assert.match(preflight.headers['access-control-allow-headers'], /Authorization/);

      for (const origin of ['https://evil.example', 'http://localhost:5500', `${ALLOWED_ORIGIN}.evil.example`]) {
        const response = await api.get('/api/health').set('Origin', origin);
        assert.equal(response.headers['access-control-allow-origin'], undefined, origin);
      }
    });

    it('requires real settings in production and refuses a wildcard origin', () => {
      const production = { NODE_ENV: 'production', MONGODB_URI: 'mongodb+srv://example', JWT_SECRET: 'x'.repeat(40), FRONTEND_URL: 'https://app.netlify.app/' };
      assert.deepEqual(loadConfig(production).corsOrigins, ['https://app.netlify.app']);
      assert.equal(loadConfig(production).serveFrontend, false);
      assert.equal(loadConfig({ ...production, PORT: '10000' }).port, 10000);
      for (const missing of ['MONGODB_URI', 'JWT_SECRET', 'FRONTEND_URL']) {
        assert.throws(() => loadConfig({ ...production, [missing]: '' }), new RegExp(missing));
      }
      assert.throws(() => loadConfig({ ...production, JWT_SECRET: 'short' }), /JWT_SECRET/);
      assert.throws(() => loadConfig({ ...production, FRONTEND_URL: '*' }), /FRONTEND_URL/);
      // The thrown message names the setting but never repeats its value.
      assert.throws(() => loadConfig({ ...production, FRONTEND_URL: '' }), (error) => !error.message.includes('mongodb+srv'));
    });

    it('uses one error format, hides internals and sets security headers', async () => {
      const missing = await api.get('/api/does-not-exist');
      assert.deepEqual([missing.status, missing.body.ok, missing.body.code], [404, false, 'NOT_FOUND']);
      const badJson = await api.post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
      assert.deepEqual([badJson.status, badJson.body.code], [400, 'INVALID_JSON']);
      const tooBig = await api.post('/api/auth/login').send({ email: 'a@example.com', password: 'x'.repeat(200 * 1024) });
      assert.deepEqual([tooBig.status, tooBig.body.code], [413, 'PAYLOAD_TOO_LARGE']);
      for (const response of [missing, badJson, tooBig]) {
        assert.equal(/stack|node_modules|at \w+ \(/.test(JSON.stringify(response.body)), false);
        assert.equal(response.headers['x-powered-by'], undefined);
        assert.equal(response.headers['x-content-type-options'], 'nosniff');
      }
      const body = JSON.stringify((await api.get('/api/admin/dashboard').set(bearer(admin.token))).body);
      assert.equal(body.includes(process.env.JWT_SECRET), false);
    });
  });
});
