/**
 * jobs.test.js — Job visibility, search / filters / pagination, recruiter ownership and the
 * approval rules (BR-07 – BR-12).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startApp, stopApp, bearer, jobForm, dateFromToday, createStudent, createAdmin, createRecruiter, createJob,
} = require('./helpers');
const Job = require('../src/models/job');

describe('jobs API', () => {
  let api;
  let admin;
  let student;
  let recruiterA;
  let recruiterB;

  before(async () => {
    api = await startApp();
    admin = await createAdmin(api);
    student = await createStudent(api);
    recruiterA = await createRecruiter(api, { approvedBy: admin, companyName: 'Alpha Labs' });
    recruiterB = await createRecruiter(api, { approvedBy: admin, companyName: 'Beta Works' });
  });
  after(stopApp);

  const search = (query = '') => api.get(`/api/jobs${query}`).set(bearer(student.token));

  describe('posting and approval', () => {
    it('saves a new job as pending with the owner and company taken from the session', async () => {
      const response = await api.post('/api/recruiter/jobs').set(bearer(recruiterA.token)).send(jobForm({
        // Fields a recruiter must not control:
        status: 'approved', recruiterId: recruiterB.user.id, recruiter: recruiterB.user.id, companyName: 'Fake Co',
      }));
      assert.equal(response.status, 201);
      assert.equal(response.body.data.status, 'pending');
      assert.equal(response.body.data.recruiterId, recruiterA.user.id);
      assert.equal(response.body.data.companyName, 'Alpha Labs');
    });

    it('validates required fields, lengths, dates and pay', async () => {
      const response = await api.post('/api/recruiter/jobs').set(bearer(recruiterA.token)).send(jobForm({
        title: '',
        description: 'x'.repeat(2001),
        deadline: dateFromToday(-1),
        salaryMin: '500000',
        salaryMax: '100',
        jobType: 'internship', // internships must be paid per month
        skills: [],
        openings: '0',
      }));
      assert.equal(response.status, 400);
      assert.deepEqual(Object.keys(response.body.fieldErrors).sort(),
        ['deadline', 'description', 'openings', 'salaryMax', 'salaryPeriod', 'skills', 'title']);
    });

    it('hides pending jobs from students until an admin approves them', async () => {
      const job = await createJob(api, recruiterA, { title: 'Hidden Until Approved' });
      assert.equal((await search('?query=Hidden+Until+Approved')).body.data.total, 0);
      assert.equal((await api.get(`/api/jobs/${job.id}`).set(bearer(student.token))).status, 404);

      const approval = await api.post(`/api/admin/jobs/${job.id}/approve`).set(bearer(admin.token));
      assert.equal(approval.status, 200);
      assert.equal(approval.body.data.status, 'approved');
      assert.equal(approval.body.data.recruiterId, recruiterA.user.id, 'approval never changes the owner');
      assert.equal(approval.body.data.title, 'Hidden Until Approved');

      assert.equal((await search('?query=Hidden+Until+Approved')).body.data.total, 1);
      assert.equal((await api.get(`/api/jobs/${job.id}`).set(bearer(student.token))).status, 200);
    });

    it('does not let a recruiter approve a job, by any route or field', async () => {
      const job = await createJob(api, recruiterA);
      const headers = bearer(recruiterA.token);
      assert.equal((await api.post(`/api/admin/jobs/${job.id}/approve`).set(headers)).status, 403);
      const edit = await api.patch(`/api/recruiter/jobs/${job.id}`).set(headers).send(jobForm({ status: 'approved' }));
      assert.equal(edit.status, 200);
      assert.equal(edit.body.data.job.status, 'pending');
      assert.equal((await Job.findById(job.id)).status, 'pending');
    });

    it('approves and rejects only pending jobs, and rejection needs a reason', async () => {
      const job = await createJob(api, recruiterA);
      const headers = bearer(admin.token);
      assert.equal((await api.post(`/api/admin/jobs/${job.id}/reject`).set(headers).send({ reason: '  ' })).status, 400);
      const rejected = await api.post(`/api/admin/jobs/${job.id}/reject`).set(headers).send({ reason: ' Salary missing ' });
      assert.equal(rejected.status, 200);
      assert.equal(rejected.body.data.status, 'rejected');
      assert.equal(rejected.body.data.rejectionReason, 'Salary missing');
      assert.equal((await api.post(`/api/admin/jobs/${job.id}/approve`).set(headers)).status, 409);
      assert.equal((await api.post(`/api/admin/jobs/${job.id}/reject`).set(headers).send({ reason: 'again' })).status, 409);

      const mine = await api.get('/api/recruiter/jobs?status=rejected').set(bearer(recruiterA.token));
      const entry = mine.body.data.items.find((item) => item.job.id === job.id);
      assert.equal(entry.job.rejectionReason, 'Salary missing', 'the recruiter sees the reason');
    });
  });

  describe('ownership', () => {
    it('lets a recruiter see and manage only their own jobs', async () => {
      const job = await createJob(api, recruiterA, { approvedBy: admin, title: 'Owned By A' });
      const other = bearer(recruiterB.token);
      assert.equal((await api.get(`/api/recruiter/jobs/${job.id}`).set(other)).status, 404);
      assert.equal((await api.patch(`/api/recruiter/jobs/${job.id}`).set(other).send(jobForm({ title: 'Stolen' }))).status, 404);
      assert.equal((await api.post(`/api/recruiter/jobs/${job.id}/close`).set(other)).status, 404);
      assert.equal((await api.get(`/api/recruiter/jobs/${job.id}/applications`).set(other)).status, 404);

      const stored = await Job.findById(job.id);
      assert.equal(stored.title, 'Owned By A');
      assert.equal(stored.status, 'approved');

      const listB = await api.get('/api/recruiter/jobs').set(other);
      assert.equal(listB.body.data.items.some((item) => item.job.id === job.id), false);
      const listA = await api.get('/api/recruiter/jobs').set(bearer(recruiterA.token));
      assert.equal(listA.body.data.items.some((item) => item.job.id === job.id), true);
    });

    it('sends an approved job back to pending only when core fields change (BR-11)', async () => {
      const job = await createJob(api, recruiterA, { approvedBy: admin, title: 'Core Field Job' });
      const headers = bearer(recruiterA.token);

      const minor = await api.patch(`/api/recruiter/jobs/${job.id}`).set(headers)
        .send(jobForm({ title: 'Core Field Job', location: 'Mumbai', openings: '5' }));
      assert.equal(minor.body.data.returnedToPending, false);
      assert.equal(minor.body.data.job.status, 'approved');
      assert.equal(minor.body.data.job.location, 'Mumbai');

      const core = await api.patch(`/api/recruiter/jobs/${job.id}`).set(headers)
        .send(jobForm({ title: 'Core Field Job (Senior)', location: 'Mumbai', openings: '5' }));
      assert.equal(core.body.data.returnedToPending, true);
      assert.equal(core.body.data.job.status, 'pending');
      assert.equal(core.body.data.job.recruiterId, recruiterA.user.id);
      assert.equal((await api.get(`/api/jobs/${job.id}`).set(bearer(student.token))).status, 404);
    });

    it('closes only approved jobs; closed and rejected jobs cannot be edited', async () => {
      const headers = bearer(recruiterA.token);
      const pending = await createJob(api, recruiterA);
      assert.equal((await api.post(`/api/recruiter/jobs/${pending.id}/close`).set(headers)).status, 409);

      const job = await createJob(api, recruiterA, { approvedBy: admin, title: 'Soon Closed' });
      const closed = await api.post(`/api/recruiter/jobs/${job.id}/close`).set(headers);
      assert.equal(closed.body.data.status, 'closed');
      assert.equal((await api.patch(`/api/recruiter/jobs/${job.id}`).set(headers).send(jobForm())).status, 409);
      assert.equal((await search('?query=Soon+Closed')).body.data.total, 0, 'closed jobs leave job search');
      assert.equal((await api.get(`/api/jobs/${job.id}`).set(bearer(student.token))).status, 404);
    });
  });

  describe('search, filters and pagination', () => {
    before(async () => {
      const make = (overrides) => createJob(api, recruiterB, { approvedBy: admin, ...overrides });
      await make({ title: 'Zeta React Engineer', location: 'Bengaluru', workMode: 'remote', skills: ['React', 'TypeScript'], salaryMin: '700000', salaryMax: '900000' });
      await make({ title: 'Zeta Data Intern', location: 'Pune', jobType: 'internship', salaryPeriod: 'month', salaryMin: '10000', salaryMax: '12000', skills: ['Python', 'SQL'] });
      await make({ title: 'Zeta Support Associate', location: 'pune', jobType: 'part-time', workMode: 'on-site', salaryMin: '', salaryMax: '', skills: ['Communication'] });
      const expired = await make({ title: 'Zeta Expired Role', skills: ['React'] });
      // Move the deadline into the past directly: the API itself refuses past deadlines.
      const job = await Job.findById(expired.id);
      job.deadline = dateFromToday(-3);
      await job.save();
    });

    it('matches every typed word in title, company or skills, ignoring case and extra spaces', async () => {
      assert.equal((await search('?query=zeta')).body.data.total, 3);
      assert.equal((await search('?query=%20ZETA%20%20%20react%20')).body.data.total, 1);
      assert.equal((await search('?query=beta+works+python')).body.data.total, 1, 'company + skill');
      assert.equal((await search('?query=zeta+nomatch')).body.data.total, 0);
      assert.equal((await search('?query=.*')).body.data.total, 0, 'special characters are matched literally');
    });

    it('filters by location, type, mode, pay range and skills (AND)', async () => {
      assert.equal((await search('?query=zeta&location=PUNE')).body.data.total, 2);
      assert.equal((await search('?query=zeta&jobType=internship')).body.data.total, 1);
      assert.equal((await search('?query=zeta&workMode=remote')).body.data.total, 1);
      assert.equal((await search('?query=zeta&payRange=stipend-upto-15k')).body.data.total, 1);
      assert.equal((await search('?query=zeta&payRange=salary-6l-plus')).body.data.total, 1);
      assert.equal((await search('?query=zeta&payRange=salary-upto-4l')).body.data.total, 0, 'undisclosed pay matches no range');
      assert.equal((await search('?query=zeta&skills=react,typescript')).body.data.total, 1);
      assert.equal((await search('?query=zeta&skills=react,python')).body.data.total, 0);
      assert.equal((await search('?query=zeta&location=Pune&jobType=internship&skills=sql')).body.data.total, 1);
    });

    it('hides expired jobs unless asked, and marks them', async () => {
      const withExpired = await search('?query=zeta&includeExpired=true');
      assert.equal(withExpired.body.data.total, 4);
      const expired = withExpired.body.data.items.find((job) => job.title === 'Zeta Expired Role');
      assert.equal(expired.isExpired, true);
      assert.equal((await search('?query=zeta')).body.data.items.every((job) => job.isExpired === false), true);
    });

    it('sorts by newest, deadline and salary', async () => {
      const salary = await search('?query=zeta&sort=salary');
      assert.deepEqual(salary.body.data.items.map((job) => job.title),
        ['Zeta React Engineer', 'Zeta Data Intern', 'Zeta Support Associate']);
      const newest = await search('?query=zeta&sort=newest');
      assert.equal(newest.body.data.items[0].title, 'Zeta Support Associate');
      assert.equal((await search('?query=zeta&sort=__proto__')).status, 200, 'unknown sort falls back');
    });

    it('paginates on the server and clamps the page number', async () => {
      const first = await search('?query=zeta&includeExpired=true&limit=3&page=1');
      assert.equal(first.body.data.items.length, 3);
      assert.deepEqual([first.body.data.page, first.body.data.totalPages, first.body.data.from, first.body.data.to], [1, 2, 1, 3]);
      const second = await search('?query=zeta&includeExpired=true&limit=3&page=2');
      assert.equal(second.body.data.items.length, 1);
      const beyond = await search('?query=zeta&includeExpired=true&limit=3&page=99');
      assert.equal(beyond.body.data.page, 2);
      const huge = await search('?limit=100000');
      assert.ok(huge.body.data.limit <= 100, 'the page size is capped');
    });

    it('ignores query operators sent as parameters', async () => {
      const response = await search('?location[$ne]=x&jobType[$gt]=&query[$regex]=.*');
      assert.equal(response.status, 200);
      const all = await search('');
      assert.equal(response.body.data.total, all.body.data.total, 'operator-shaped parameters filter nothing');
    });

    it('offers filter options and never shows moderation notes to students', async () => {
      const options = await api.get('/api/jobs/filter-options').set(bearer(student.token));
      assert.ok(options.body.data.locations.includes('Bengaluru'));
      assert.equal(options.body.data.locations.filter((value) => value.toLowerCase() === 'pune').length, 1);
      assert.ok(options.body.data.skills.includes('React'));
      const jobs = (await search('?query=zeta')).body.data.items;
      assert.equal(jobs.some((job) => 'rejectionReason' in job), false);
    });
  });
});
