/**
 * student.test.js — Saved jobs, profile and resume: ownership and validation, and the student
 * dashboard built from the student's own records.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startApp, stopApp, bearer, pdfOfSize, createStudent, createAdmin, createRecruiter, createJob, login,
} = require('./helpers');
const User = require('../src/models/user');
const SavedJob = require('../src/models/saved-job');
const Resume = require('../src/models/resume');

const MAX_RESUME = 500 * 1024;

describe('student API', () => {
  let api;
  let admin;
  let studentA;
  let studentB;
  let recruiter;
  let job;

  before(async () => {
    api = await startApp();
    admin = await createAdmin(api);
    studentA = await createStudent(api, { name: 'Student A' });
    studentB = await createStudent(api, { name: 'Student B' });
    recruiter = await createRecruiter(api, { approvedBy: admin });
    job = await createJob(api, recruiter, { approvedBy: admin, title: 'Saved Job', skills: ['JavaScript', 'CSS'] });
  });
  after(stopApp);

  const uploadResume = (student, data, { type = 'application/pdf', name = 'my-resume.pdf' } = {}) => api
    .put('/api/student/resume')
    .set(bearer(student.token))
    .set('Content-Type', type)
    .set('X-File-Name', encodeURIComponent(name))
    .send(data);

  describe('saved jobs', () => {
    it('saves once, lists only the student\'s own, and unsaves', async () => {
      const headers = bearer(studentA.token);
      assert.deepEqual((await api.put(`/api/student/saved-jobs/${job.id}`).set(headers)).body.data, { saved: true });
      assert.equal((await api.put(`/api/student/saved-jobs/${job.id}`).set(headers)).status, 200, 'saving twice is harmless');
      assert.equal(await SavedJob.countDocuments({ student: studentA.user.id }), 1);

      const mine = await api.get('/api/student/saved-jobs').set(headers);
      assert.equal(mine.body.data.items.length, 1);
      assert.equal(mine.body.data.items[0].job.title, 'Saved Job');
      assert.equal(mine.body.data.items[0].availability, 'open');
      assert.equal((await api.get('/api/student/saved-jobs').set(bearer(studentB.token))).body.data.items.length, 0);

      const search = await api.get('/api/jobs?query=Saved+Job').set(headers);
      assert.equal(search.body.data.items[0].isSaved, true);
      const searchB = await api.get('/api/jobs?query=Saved+Job').set(bearer(studentB.token));
      assert.equal(searchB.body.data.items[0].isSaved, false);

      // Student B unsaving the same job does not touch student A's saved link.
      await api.delete(`/api/student/saved-jobs/${job.id}`).set(bearer(studentB.token));
      assert.equal(await SavedJob.countDocuments({ student: studentA.user.id }), 1);
      assert.deepEqual((await api.delete(`/api/student/saved-jobs/${job.id}`).set(headers)).body.data, { saved: false });
      assert.equal(await SavedJob.countDocuments({ student: studentA.user.id }), 0);
    });

    it('cannot save a job that students may not see, or as another role', async () => {
      const pending = await createJob(api, recruiter);
      assert.equal((await api.put(`/api/student/saved-jobs/${pending.id}`).set(bearer(studentA.token))).status, 404);
      assert.equal((await api.put(`/api/student/saved-jobs/${job.id}`).set(bearer(recruiter.token))).status, 403);
      assert.equal((await api.put(`/api/student/saved-jobs/${job.id}`)).status, 401);
    });

    it('keeps a saved link when the job closes, marked as closed', async () => {
      const closing = await createJob(api, recruiter, { approvedBy: admin, title: 'Closing Soon' });
      await api.put(`/api/student/saved-jobs/${closing.id}`).set(bearer(studentB.token));
      await api.post(`/api/recruiter/jobs/${closing.id}/close`).set(bearer(recruiter.token));
      const list = await api.get('/api/student/saved-jobs').set(bearer(studentB.token));
      const item = list.body.data.items.find((entry) => entry.record.jobId === closing.id);
      assert.equal(item.availability, 'closed');
      assert.equal(item.job.title, 'Closing Soon');
      assert.equal((await api.delete(`/api/student/saved-jobs/${closing.id}`).set(bearer(studentB.token))).status, 200);
    });
  });

  describe('profile', () => {
    const patch = (student, section, body) => api.patch(`/api/student/profile/${section}`).set(bearer(student.token)).send(body);

    it('saves each section for the logged-in student only and updates completeness', async () => {
      const before = (await api.get('/api/auth/me').set(bearer(studentA.token))).body.data.user;
      assert.equal(before.completeness.percent, 53, '8 of 15 items after registration');

      const personal = await patch(studentA, 'personal', {
        name: '  Asha Rao ', phone: '9000000000', location: ' Pune ', about: 'Likes building things.',
      });
      assert.equal(personal.status, 200);
      assert.equal(personal.body.data.name, 'Asha Rao');
      assert.equal(personal.body.data.profile.location, 'Pune');

      const skills = await patch(studentA, 'skills', { skills: ['JavaScript', ' CSS '] });
      assert.deepEqual(skills.body.data.profile.skills, ['JavaScript', 'CSS']);

      const education = await patch(studentA, 'education', {
        college: 'New College', degree: 'B.Tech', branch: 'IT', graduationYear: String(new Date().getFullYear()), cgpa: '9.126',
        education: [{ level: 'HSC', institute: 'City College', year: '2022', score: '88%' }],
      });
      assert.equal(education.body.data.profile.cgpa, 9.13);
      assert.equal(education.body.data.profile.education[0].year, 2022);

      const projects = await patch(studentA, 'projects', {
        projects: [{ title: 'Portfolio', description: 'A site', link: 'https://example.com/p' }],
        links: { github: 'https://github.com/example', linkedin: '', portfolio: '' },
      });
      assert.equal(projects.body.data.completeness.percent, 93, 'everything except the resume');
      assert.deepEqual(projects.body.data.completeness.missing, ['Resume']);

      // Persisted: a new login returns the same profile; the other student is untouched.
      const again = await login(api, studentA.email);
      assert.equal(again.user.profile.projects[0].title, 'Portfolio');
      const other = (await api.get('/api/auth/me').set(bearer(studentB.token))).body.data.user;
      assert.equal(other.name, 'Student B');
      assert.deepEqual(other.profile.skills, []);
    });

    it('never changes protected fields, whatever the request contains', async () => {
      const response = await patch(studentB, 'personal', {
        name: 'Student B',
        phone: '9876543210',
        role: 'admin',
        status: 'blocked',
        email: 'hacked@example.com',
        id: studentA.user.id,
        _id: studentA.user.id,
        passwordHash: 'x',
        tokenVersion: 50,
        studentProfile: { cgpa: 10 },
        'studentProfile.cgpa': 10,
      });
      assert.equal(response.status, 200);
      const stored = await User.findById(studentB.user.id).select('+passwordHash');
      assert.equal(stored.role, 'student');
      assert.equal(stored.status, 'active');
      assert.equal(stored.email, studentB.email);
      assert.equal(stored.tokenVersion, 0);
      assert.equal(stored.studentProfile.cgpa, 8.5);
      assert.notEqual(stored.passwordHash, 'x');
      assert.equal((await User.findById(studentA.user.id)).name, 'Asha Rao', 'another user id in the body changes nothing');
    });

    it('validates input and refuses unknown sections and other roles', async () => {
      const invalid = await patch(studentB, 'projects', {
        projects: [{ title: '', link: 'javascript:alert(1)' }],
        links: { github: 'ftp://example.com' },
      });
      assert.equal(invalid.status, 400);
      assert.deepEqual(Object.keys(invalid.body.fieldErrors).sort(), ['links.github', 'projects.0.link', 'projects.0.title']);

      assert.equal((await patch(studentB, 'skills', { skills: Array.from({ length: 31 }, (_, i) => `skill${i}`) })).status, 400);
      assert.equal((await patch(studentB, 'skills', { skills: ['Java', 'java'] })).status, 400);
      assert.equal((await patch(studentB, 'password', { password: 'NewPassw0rd' })).body.code, 'INVALID_SECTION');
      assert.equal((await patch(recruiter, 'personal', { name: 'X', phone: '9876543210' })).status, 403);
    });

    it('lets a recruiter edit only their own company profile', async () => {
      const response = await api.patch('/api/recruiter/profile').set(bearer(recruiter.token)).send({
        name: 'Recruiter One', phone: '9123456789', companyName: 'Acme', designation: 'Lead', companyLocation: 'Pune',
        companyWebsite: 'javascript:alert(1)', companySize: '5000',
      });
      assert.equal(response.status, 400);
      assert.deepEqual(Object.keys(response.body.fieldErrors).sort(), ['companySize', 'companyWebsite']);
      assert.equal((await api.patch('/api/recruiter/profile').set(bearer(studentA.token)).send({})).status, 403);
    });
  });

  describe('resume', () => {
    it('accepts a PDF up to 500 KB and returns it only to its owner', async () => {
      const file = pdfOfSize(MAX_RESUME);
      const response = await uploadResume(studentA, file, { name: '../../etc/My Résumé.pdf' });
      assert.equal(response.status, 200);
      assert.deepEqual(
        [response.body.data.profile.resume.fileName, response.body.data.profile.resume.sizeBytes],
        ['My Résumé.pdf', MAX_RESUME],
      );
      assert.equal(response.body.data.completeness.percent, 100);
      assert.equal(JSON.stringify(response.body).length < 5000, true, 'the file itself is not echoed back');

      const download = await api.get('/api/student/resume').set(bearer(studentA.token)).buffer(true).parse((res, done) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
      assert.equal(download.status, 200);
      assert.equal(download.headers['content-type'], 'application/pdf');
      assert.match(download.headers['cache-control'], /no-store/);
      assert.equal(Buffer.compare(download.body, file), 0, 'identical bytes');

      assert.equal((await api.get('/api/student/resume').set(bearer(studentB.token))).status, 404, 'B has no resume');
      assert.equal((await api.get('/api/student/resume')).status, 401);
    });

    it('rejects other file types, disguised files, empty and oversized files, keeping the old resume', async () => {
      const cases = [
        [await uploadResume(studentA, Buffer.from('hello'), { type: 'text/plain' }), 400],
        [await uploadResume(studentA, Buffer.from('PK\u0003\u0004 not a pdf')), 400], // PDF type, wrong content
        [await uploadResume(studentA, Buffer.alloc(0)), 400],
        [await uploadResume(studentA, pdfOfSize(MAX_RESUME + 1)), 400],
        [await uploadResume(studentA, pdfOfSize(MAX_RESUME + 4096)), 413],
      ];
      cases.forEach(([response, status], index) => {
        assert.equal(response.status, status, `case ${index}`);
        assert.equal(response.body.ok, false);
      });
      const stored = await Resume.findOne({ student: studentA.user.id });
      assert.equal(stored.sizeBytes, MAX_RESUME, 'the previous resume is still there');
      assert.equal(stored.fileName, 'My Résumé.pdf');
    });

    it('records the file name on new applications and lets only the job\'s recruiter open the file', async () => {
      const applied = await api.post(`/api/jobs/${job.id}/applications`).set(bearer(studentA.token)).send({});
      assert.equal(applied.body.data.resumeFileName, 'My Résumé.pdf');
      const applicationId = applied.body.data.id;

      const own = await api.get(`/api/recruiter/applications/${applicationId}/resume`).set(bearer(recruiter.token));
      assert.equal(own.status, 200);
      assert.equal(own.headers['content-type'], 'application/pdf');

      const otherRecruiter = await createRecruiter(api, { approvedBy: admin });
      assert.equal((await api.get(`/api/recruiter/applications/${applicationId}/resume`).set(bearer(otherRecruiter.token))).status, 404);
      assert.equal((await api.get(`/api/recruiter/applications/${applicationId}/resume`).set(bearer(studentB.token))).status, 403);
      assert.equal((await api.get(`/api/recruiter/applications/${applicationId}/resume`)).status, 401);
    });

    it('removes the resume without changing past applications', async () => {
      const removed = await api.delete('/api/student/resume').set(bearer(studentA.token));
      assert.equal(removed.status, 200);
      assert.equal(removed.body.data.profile.resume, null);
      assert.equal(await Resume.countDocuments({ student: studentA.user.id }), 0);
      assert.equal((await api.delete('/api/student/resume').set(bearer(studentA.token))).status, 404);
      const list = await api.get('/api/student/applications').set(bearer(studentA.token));
      assert.equal(list.body.data.items[0].application.resumeFileName, 'My Résumé.pdf');
    });
  });

  describe('dashboard', () => {
    it('is built only from the student\'s own records', async () => {
      const dashboardA = (await api.get('/api/student/dashboard').set(bearer(studentA.token))).body.data;
      assert.equal(dashboardA.stats.applications, 1);
      assert.equal(dashboardA.stats.savedJobs, 0);
      assert.equal(dashboardA.recentApplications[0].job.title, 'Saved Job');
      assert.equal(dashboardA.statusBreakdown.total, 1);
      assert.deepEqual(dashboardA.statusBreakdown.items.find((item) => item.key === 'applied'), { key: 'applied', count: 1, percent: 100 });
      assert.equal(dashboardA.recommended.items.some((item) => item.job.id === job.id), false, 'applied jobs are not recommended');

      const dashboardB = (await api.get('/api/student/dashboard').set(bearer(studentB.token))).body.data;
      assert.equal(dashboardB.stats.applications, 0);
      assert.equal(dashboardB.statusBreakdown.total, 0);
      assert.equal(dashboardB.statusBreakdown.items.every((item) => item.percent === 0), true, 'no division by zero');
      assert.equal(dashboardB.recommended.isSkillBased, false, 'no skills on the profile yet');
      assert.ok(dashboardB.recommended.items.length > 0);

      await api.patch('/api/student/profile/skills').set(bearer(studentB.token)).send({ skills: ['css'] });
      const matched = (await api.get('/api/student/dashboard').set(bearer(studentB.token))).body.data.recommended;
      assert.equal(matched.isSkillBased, true);
      assert.deepEqual(matched.items[0].matchedSkills, ['CSS']);
    });
  });
});
