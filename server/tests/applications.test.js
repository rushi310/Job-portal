/**
 * applications.test.js — Applying, duplicates, ownership, status flow, withdrawal and the
 * status timeline (BR-12 – BR-17).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startApp, stopApp, bearer, dateFromToday, createStudent, createAdmin, createRecruiter, createJob,
} = require('./helpers');
const Application = require('../src/models/application');
const Job = require('../src/models/job');

describe('applications API', () => {
  let api;
  let admin;
  let studentA;
  let studentB;
  let recruiterA;
  let recruiterB;
  let job;

  before(async () => {
    api = await startApp();
    admin = await createAdmin(api);
    studentA = await createStudent(api, { name: 'Student A' });
    studentB = await createStudent(api, { name: 'Student B' });
    recruiterA = await createRecruiter(api, { approvedBy: admin });
    recruiterB = await createRecruiter(api, { approvedBy: admin });
    job = await createJob(api, recruiterA, { approvedBy: admin, title: 'Main Job' });
  });
  after(stopApp);

  const apply = (student, jobId, body = {}) => api.post(`/api/jobs/${jobId}/applications`).set(bearer(student.token)).send(body);
  const setStatus = (recruiter, applicationId, status) => api
    .patch(`/api/recruiter/applications/${applicationId}/status`).set(bearer(recruiter.token)).send({ status });
  const freshJob = (overrides = {}) => createJob(api, recruiterA, { approvedBy: admin, ...overrides });

  describe('applying', () => {
    it('creates an application with the first timeline entry and notifies the recruiter', async () => {
      const response = await apply(studentA, job.id, { coverNote: '  I would love to join.  ' });
      assert.equal(response.status, 201);
      const application = response.body.data;
      assert.equal(application.status, 'applied');
      assert.equal(application.coverNote, 'I would love to join.');
      assert.equal(application.studentId, studentA.user.id);
      assert.equal(application.jobId, job.id);
      assert.equal(application.resumeFileName, null);
      assert.deepEqual(application.statusHistory.map((entry) => entry.status), ['applied']);

      const inbox = await api.get('/api/notifications').set(bearer(recruiterA.token));
      const note = inbox.body.data.items.find((item) => item.type === 'application');
      assert.match(note.message, /Student A applied for Main Job/);
      assert.equal(note.link, `pages/recruiter/applicants.html?jobId=${job.id}`);
    });

    it('rejects a second application, and simultaneous ones create exactly one record', async () => {
      const again = await apply(studentA, job.id);
      assert.equal(again.status, 409);
      assert.equal(again.body.code, 'ALREADY_APPLIED');

      const other = await freshJob();
      const responses = await Promise.all(Array.from({ length: 5 }, () => apply(studentB, other.id)));
      assert.equal(responses.filter((response) => response.status === 201).length, 1);
      assert.equal(responses.filter((response) => response.status === 409).length, 4);
      assert.equal(await Application.countDocuments({ student: studentB.user.id, job: other.id }), 1);
    });

    it('ignores a student id or status sent by the client', async () => {
      const other = await freshJob();
      const response = await apply(studentA, other.id, { studentId: studentB.user.id, student: studentB.user.id, status: 'selected' });
      assert.equal(response.status, 201);
      assert.equal(response.body.data.studentId, studentA.user.id);
      assert.equal(response.body.data.status, 'applied');
    });

    it('refuses pending, closed, expired and unknown jobs, and ineligible students', async () => {
      const pending = await createJob(api, recruiterA);
      assert.equal((await apply(studentB, pending.id)).status, 404);

      const closed = await freshJob();
      await api.post(`/api/recruiter/jobs/${closed.id}/close`).set(bearer(recruiterA.token));
      assert.equal((await apply(studentB, closed.id)).status, 404);

      const expired = await freshJob();
      const stored = await Job.findById(expired.id);
      stored.deadline = dateFromToday(-1);
      await stored.save();
      const late = await apply(studentB, expired.id);
      assert.equal(late.status, 409);
      assert.equal(late.body.code, 'JOB_EXPIRED');

      assert.equal((await apply(studentB, '64b000000000000000000000')).status, 404);
      assert.equal((await apply(studentB, 'not-an-id')).status, 404);

      const strict = await freshJob({ minCgpa: '9.5', degrees: ['MCA'] });
      const ineligible = await apply(studentB, strict.id);
      assert.equal(ineligible.status, 409);
      assert.equal(ineligible.body.code, 'NOT_ELIGIBLE');
      const details = await api.get(`/api/jobs/${strict.id}`).set(bearer(studentB.token));
      assert.equal(details.body.data.eligibility.isEligible, false);
      assert.equal(details.body.data.applyStatus.canApply, false);
    });

    it('validates the cover note', async () => {
      const other = await freshJob();
      const tooLong = await apply(studentB, other.id, { coverNote: 'x'.repeat(1001) });
      assert.equal(tooLong.status, 400);
      assert.ok(tooLong.body.fieldErrors.coverNote);
      assert.equal((await apply(studentB, other.id, { coverNote: { $ne: 1 } })).status, 400);
    });
  });

  describe('ownership', () => {
    it('shows a student only their own applications', async () => {
      const listA = await api.get('/api/student/applications').set(bearer(studentA.token));
      const listB = await api.get('/api/student/applications').set(bearer(studentB.token));
      assert.ok(listA.body.data.items.length > 0);
      assert.equal(listA.body.data.items.every((item) => item.application.studentId === studentA.user.id), true);
      assert.equal(listB.body.data.items.every((item) => item.application.studentId === studentB.user.id), true);
      // A student id in the URL does not widen the list.
      const spoofed = await api.get(`/api/student/applications?studentId=${studentA.user.id}`).set(bearer(studentB.token));
      assert.equal(spoofed.body.data.items.every((item) => item.application.studentId === studentB.user.id), true);
    });

    it('shows a recruiter only applications to their own jobs', async () => {
      const mine = await api.get(`/api/recruiter/jobs/${job.id}/applications`).set(bearer(recruiterA.token));
      assert.equal(mine.status, 200);
      assert.equal(mine.body.data.items.length, 1);
      assert.equal(mine.body.data.items[0].candidateName, 'Student A');
      const applicationId = mine.body.data.items[0].application.id;

      const other = bearer(recruiterB.token);
      assert.equal((await api.get(`/api/recruiter/jobs/${job.id}/applications`).set(other)).status, 404);
      assert.equal((await api.get(`/api/recruiter/applications/${applicationId}`).set(other)).status, 404);
      assert.equal((await api.get(`/api/recruiter/applications/${applicationId}/resume`).set(other)).status, 404);
      assert.equal((await setStatus(recruiterB, applicationId, 'under_review')).status, 404);
      assert.equal((await Application.findById(applicationId)).status, 'applied');

      const dashboardB = await api.get('/api/recruiter/dashboard').set(other);
      assert.equal(dashboardB.body.data.stats.totalApplicants, 0);
    });

    it('gives the recruiter the candidate profile without account internals', async () => {
      const list = await api.get(`/api/recruiter/jobs/${job.id}/applications`).set(bearer(recruiterA.token));
      const details = await api.get(`/api/recruiter/applications/${list.body.data.items[0].application.id}`).set(bearer(recruiterA.token));
      const { candidate } = details.body.data;
      assert.equal(candidate.name, 'Student A');
      assert.equal(candidate.profile.college, 'Test College');
      assert.deepEqual(Object.keys(candidate).sort(), ['email', 'id', 'name', 'phone', 'profile']);
      assert.equal(JSON.stringify(details.body).includes('passwordHash'), false);
    });

    it('does not let a student change an application status', async () => {
      const list = await api.get('/api/student/applications').set(bearer(studentA.token));
      const applicationId = list.body.data.items[0].application.id;
      assert.equal((await setStatus(studentA, applicationId, 'selected')).status, 403);
    });
  });

  describe('status flow and timeline', () => {
    it('allows only the next step or rejected, keeps the history and notifies the student', async () => {
      const other = await freshJob({ title: 'Flow Job' });
      const applicationId = (await apply(studentA, other.id)).body.data.id;

      for (const invalid of ['shortlisted', 'selected', 'applied', 'withdrawn', 'made_up', '']) {
        const response = await setStatus(recruiterA, applicationId, invalid);
        assert.equal(response.status, 409, `applied → ${invalid || '(empty)'}`);
        assert.equal(response.body.code, 'INVALID_TRANSITION');
      }
      for (const next of ['under_review', 'shortlisted', 'interview', 'selected']) {
        assert.equal((await setStatus(recruiterA, applicationId, next)).status, 200, next);
      }
      // Final: nothing more is allowed.
      assert.equal((await setStatus(recruiterA, applicationId, 'rejected')).status, 409);

      const stored = await Application.findById(applicationId);
      assert.deepEqual(stored.statusHistory.map((entry) => entry.status),
        ['applied', 'under_review', 'shortlisted', 'interview', 'selected']);
      assert.ok(stored.statusHistory.every((entry) => entry.at instanceof Date));

      // The student sees the same timeline after "logging in again" (a fresh request).
      const list = await api.get('/api/student/applications?status=selected').set(bearer(studentA.token));
      const item = list.body.data.items.find((entry) => entry.application.id === applicationId);
      assert.equal(item.application.statusHistory.length, 5);
      assert.equal(item.job.title, 'Flow Job');

      const inbox = await api.get('/api/notifications').set(bearer(studentA.token));
      const titles = inbox.body.data.items.filter((note) => note.type === 'status').map((note) => note.title);
      assert.ok(titles.includes('You have been selected'));
      assert.equal(titles.length, 4, 'one notification per status change');
    });

    it('lets a recruiter reject from an early stage', async () => {
      const other = await freshJob();
      const applicationId = (await apply(studentA, other.id)).body.data.id;
      const rejected = await setStatus(recruiterA, applicationId, 'rejected');
      assert.equal(rejected.body.data.status, 'rejected');
      assert.equal((await setStatus(recruiterA, applicationId, 'under_review')).status, 409);
    });
  });

  describe('withdrawal', () => {
    const withdraw = (student, applicationId) => api
      .post(`/api/student/applications/${applicationId}/withdraw`).set(bearer(student.token));

    it('works from applied / under_review, is recorded, and still blocks re-applying', async () => {
      const other = await freshJob();
      const applicationId = (await apply(studentA, other.id)).body.data.id;
      await setStatus(recruiterA, applicationId, 'under_review');

      assert.equal((await withdraw(studentB, applicationId)).status, 404, 'another student cannot withdraw it');
      const response = await withdraw(studentA, applicationId);
      assert.equal(response.status, 200);
      assert.equal(response.body.data.status, 'withdrawn');
      const last = response.body.data.statusHistory.at(-1);
      assert.deepEqual([last.status, last.note], ['withdrawn', 'Withdrawn by student.']);

      assert.equal((await withdraw(studentA, applicationId)).status, 409, 'withdrawn is final');
      assert.equal((await apply(studentA, other.id)).body.code, 'ALREADY_APPLIED');
      assert.equal((await setStatus(recruiterA, applicationId, 'shortlisted')).status, 409, 'recruiter cannot change it');
    });

    it('is refused once the application is shortlisted or later', async () => {
      const other = await freshJob();
      const applicationId = (await apply(studentA, other.id)).body.data.id;
      await setStatus(recruiterA, applicationId, 'under_review');
      await setStatus(recruiterA, applicationId, 'shortlisted');
      const response = await withdraw(studentA, applicationId);
      assert.equal(response.status, 409);
      assert.equal(response.body.code, 'CANNOT_WITHDRAW');
      assert.equal((await Application.findById(applicationId)).status, 'shortlisted');
    });
  });

  describe('history', () => {
    it('keeps applications listed when the job is closed or deleted', async () => {
      const closing = await freshJob({ title: 'Will Close' });
      const deleting = await freshJob({ title: 'Will Vanish' });
      await apply(studentB, closing.id);
      await apply(studentB, deleting.id);
      await api.post(`/api/recruiter/jobs/${closing.id}/close`).set(bearer(recruiterA.token));
      assert.equal((await api.delete(`/api/admin/jobs/${deleting.id}`).set(bearer(admin.token))).status, 200);

      const list = await api.get('/api/student/applications').set(bearer(studentB.token));
      const closed = list.body.data.items.find((item) => item.application.jobId === closing.id);
      const gone = list.body.data.items.find((item) => item.application.jobId === deleting.id);
      assert.equal(closed.availability, 'closed');
      assert.deepEqual(Object.keys(closed.job).sort(), ['companyName', 'id', 'title']);
      assert.equal(gone.availability, 'unavailable');
      assert.equal(gone.job, null);
      assert.equal(list.body.data.counts.all, list.body.data.total);
    });
  });
});
