/**
 * authorization.test.js — Role and approval checks on the server (frontend guards are not a
 * security boundary): who may call which group of routes.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startApp, stopApp, bearer, jobForm, createStudent, createAdmin, createRecruiter, createJob,
} = require('./helpers');
const User = require('../src/models/user');
const Job = require('../src/models/job');

describe('authorization', () => {
  let api;
  let admin;
  let student;
  let recruiter;
  let pendingRecruiter;

  before(async () => {
    api = await startApp();
    admin = await createAdmin(api);
    student = await createStudent(api);
    recruiter = await createRecruiter(api, { approvedBy: admin });
    pendingRecruiter = await createRecruiter(api);
  });
  after(stopApp);

  const ADMIN_ROUTES = [
    ['get', '/api/admin/dashboard'],
    ['get', '/api/admin/users'],
    ['get', '/api/admin/jobs'],
    ['get', '/api/admin/reports'],
    ['get', '/api/admin/announcements'],
    ['post', '/api/admin/announcements'],
    ['post', '/api/admin/reset-demo-data'],
  ];

  const PROTECTED_ROUTES = [
    ...ADMIN_ROUTES,
    ['get', '/api/auth/me'],
    ['get', '/api/jobs'],
    ['get', '/api/student/dashboard'],
    ['get', '/api/student/applications'],
    ['get', '/api/student/saved-jobs'],
    ['get', '/api/student/resume'],
    ['get', '/api/recruiter/dashboard'],
    ['get', '/api/recruiter/jobs'],
    ['post', '/api/recruiter/jobs'],
    ['get', '/api/notifications'],
  ];

  describe('logged-out requests', () => {
    it('are denied on every protected route', async () => {
      for (const [method, path] of PROTECTED_ROUTES) {
        const response = await api[method](path);
        assert.equal(response.status, 401, `${method.toUpperCase()} ${path}`);
        assert.equal(response.body.ok, false);
      }
    });

    it('can read only the public landing data and the health check', async () => {
      assert.equal((await api.get('/api/health')).status, 200);
      const landing = await api.get('/api/public/landing');
      assert.equal(landing.status, 200);
      assert.ok(Array.isArray(landing.body.data.featuredJobs));
    });
  });

  describe('admin routes', () => {
    it('refuse students, recruiters and pending recruiters', async () => {
      for (const session of [student, recruiter, pendingRecruiter]) {
        for (const [method, path] of ADMIN_ROUTES) {
          const response = await api[method](path).set(bearer(session.token));
          assert.equal(response.status, 403, `${session.user.role} ${method.toUpperCase()} ${path}`);
        }
      }
    });

    it('refuse admin actions on users and jobs from other roles, and nothing changes', async () => {
      const job = await createJob(api, recruiter);
      const target = pendingRecruiter.user.id;
      for (const session of [student, recruiter, pendingRecruiter]) {
        const headers = bearer(session.token);
        assert.equal((await api.post(`/api/admin/users/${target}/approve`).set(headers)).status, 403);
        assert.equal((await api.post(`/api/admin/users/${student.user.id}/block`).set(headers)).status, 403);
        assert.equal((await api.delete(`/api/admin/users/${student.user.id}`).set(headers)).status, 403);
        assert.equal((await api.post(`/api/admin/jobs/${job.id}/approve`).set(headers)).status, 403);
        assert.equal((await api.delete(`/api/admin/jobs/${job.id}`).set(headers)).status, 403);
      }
      assert.equal((await User.findById(target)).status, 'pending');
      assert.equal((await User.findById(student.user.id)).status, 'active');
      assert.equal((await Job.findById(job.id)).status, 'pending');
    });
  });

  describe('role separation', () => {
    it('keeps student routes for students and recruiter routes for recruiters', async () => {
      assert.equal((await api.get('/api/student/dashboard').set(bearer(recruiter.token))).status, 403);
      assert.equal((await api.get('/api/jobs').set(bearer(recruiter.token))).status, 403);
      assert.equal((await api.get('/api/student/dashboard').set(bearer(admin.token))).status, 403);
      assert.equal((await api.get('/api/recruiter/dashboard').set(bearer(student.token))).status, 403);
      assert.equal((await api.post('/api/recruiter/jobs').set(bearer(student.token)).send(jobForm())).status, 403);
      assert.equal((await api.get('/api/recruiter/jobs').set(bearer(admin.token))).status, 403);
    });

    it('ignores a role or user id sent by the client', async () => {
      // Extra fields claiming another identity do not change who the server thinks is calling.
      const response = await api.get('/api/auth/me?role=admin&userId=anything')
        .set(bearer(student.token))
        .set('X-User-Role', 'admin');
      assert.equal(response.body.data.user.role, 'student');
      const dashboard = await api.get(`/api/admin/dashboard?role=admin&adminId=${admin.user.id}`).set(bearer(student.token));
      assert.equal(dashboard.status, 403);
    });
  });

  describe('pending recruiters', () => {
    it('can log in, see their dashboard and edit the company profile', async () => {
      const headers = bearer(pendingRecruiter.token);
      const dashboard = await api.get('/api/recruiter/dashboard').set(headers);
      assert.equal(dashboard.status, 200);
      assert.equal(dashboard.body.data.analytics.isActive, false);
      assert.equal(dashboard.body.data.stats.totalApplicants, 0);
      const profile = await api.patch('/api/recruiter/profile').set(headers).send({
        name: 'Pending Person', phone: '9123456780', companyName: 'Waiting Co', designation: 'HR', companyLocation: 'Pune',
      });
      assert.equal(profile.status, 200);
      assert.equal(profile.body.data.status, 'pending', 'editing the profile does not approve the account');
    });

    it('cannot post, edit or close jobs or see applicants', async () => {
      const headers = bearer(pendingRecruiter.token);
      const job = await createJob(api, recruiter, { approvedBy: admin });
      const attempts = [
        api.post('/api/recruiter/jobs').set(headers).send(jobForm()),
        api.patch(`/api/recruiter/jobs/${job.id}`).set(headers).send(jobForm()),
        api.post(`/api/recruiter/jobs/${job.id}/close`).set(headers),
        api.get(`/api/recruiter/jobs/${job.id}/applications`).set(headers),
      ];
      for (const response of await Promise.all(attempts)) {
        assert.equal(response.status, 403);
        assert.equal(response.body.code, 'NOT_APPROVED');
      }
      assert.equal(await Job.countDocuments({ recruiter: pendingRecruiter.user.id }), 0);
    });

    it('can post a job immediately after an admin approves them, without logging in again', async () => {
      const fresh = await createRecruiter(api);
      assert.equal((await api.post('/api/recruiter/jobs').set(bearer(fresh.token)).send(jobForm())).status, 403);
      assert.equal((await api.post(`/api/admin/users/${fresh.user.id}/approve`).set(bearer(admin.token))).status, 200);
      assert.equal((await api.post('/api/recruiter/jobs').set(bearer(fresh.token)).send(jobForm())).status, 201);
    });
  });
});
