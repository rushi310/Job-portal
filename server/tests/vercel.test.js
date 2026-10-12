/**
 * vercel.test.js — The Vercel entry point (api/index.js) and its configuration.
 * The function is called here exactly as Vercel calls it — as a plain (req, res) handler, with no
 * server started and no database connected beforehand — in production mode without FRONTEND_URL
 * (pages and API on one domain).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const ROOT = path.join(__dirname, '../..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

describe('Vercel deployment', () => {
  let mongo;
  let api;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    // What the Vercel project provides: production mode, the database address and the token secret.
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = `${mongo.getUri()}freshhire`;
    process.env.JWT_SECRET = 'vercel-test-secret-that-is-long-enough-0123456789';
    process.env.BCRYPT_ROUNDS = '4';
    process.env.FRONTEND_URL = ''; // pages and API on one domain
    api = request(require('../../api/index.js')); // loaded only now, after the environment is set
  });
  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  describe('api/index.js', () => {
    it('connects to the database on the first request and serves the health check', async () => {
      assert.equal(mongoose.connection.readyState, 0, 'nothing is connected before the first request');
      const response = await api.get('/api/health');
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data, { status: 'ok', database: 'connected' });
    });

    it('runs the real API: register, log in, search jobs, and keep roles apart', async () => {
      const form = {
        role: 'student', name: 'Vercel Student', email: 'vercel.student@example.com', phone: '9876543210',
        password: 'Passw0rd123', confirmPassword: 'Passw0rd123', college: 'Test College', degree: 'B.E.',
        branch: 'CSE', graduationYear: String(new Date().getFullYear()), cgpa: '8',
      };
      assert.equal((await api.post('/api/auth/register').send(form)).status, 201);
      const login = await api.post('/api/auth/login').send({ email: form.email, password: form.password });
      assert.equal(login.status, 200);
      const headers = { Authorization: `Bearer ${login.body.data.token}` };

      const jobs = await api.get('/api/jobs?query=dev&page=1').set(headers);
      assert.equal(jobs.status, 200);
      assert.ok(Array.isArray(jobs.body.data.items));
      assert.equal((await api.get('/api/admin/dashboard').set(headers)).status, 403);
      assert.equal((await api.post('/api/recruiter/jobs').set(headers).send({})).status, 403);
      assert.equal((await api.get('/api/student/dashboard')).status, 401);
    });

    it('accepts a raw PDF body (resume upload) through the function', async () => {
      const login = await api.post('/api/auth/login').send({ email: 'vercel.student@example.com', password: 'Passw0rd123' });
      const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1024, 0x20)]);
      const response = await api.put('/api/student/resume')
        .set({ Authorization: `Bearer ${login.body.data.token}`, 'Content-Type': 'application/pdf', 'X-File-Name': 'cv.pdf' })
        .send(pdf);
      assert.equal(response.status, 200);
      assert.equal(response.body.data.profile.resume.sizeBytes, pdf.length);
    });

    it('allows no other origin when pages and API share a domain', async () => {
      const response = await api.get('/api/health').set('Origin', 'https://some-other-site.example');
      assert.equal(response.headers['access-control-allow-origin'], undefined);
      // The site's own pages need no permission: a same-origin request simply works.
      assert.equal((await api.get('/api/public/landing')).status, 200);
    });

    it('answers unknown API paths as JSON, never as a page', async () => {
      const response = await api.get('/api/no-such-route');
      assert.equal(response.status, 404);
      assert.deepEqual([response.body.ok, response.body.code], [false, 'NOT_FOUND']);
    });

    it('does not serve the frontend or source files itself (Vercel serves the static files)', async () => {
      assert.equal((await api.get('/index.html')).status, 404);
      assert.equal((await api.get('/server/.env')).status, 404);
    });
  });

  describe('configuration files', () => {
    const vercel = readJson('vercel.json');

    it('root package.json installs exactly the API dependencies of server/package.json', () => {
      assert.deepEqual(readJson('package.json').dependencies, readJson('server/package.json').dependencies);
    });

    it('sends only /api/* to the function, and never rewrites pages to index.html', () => {
      assert.deepEqual(vercel.rewrites, [{ source: '/api/(.*)', destination: '/api' }]);
      assert.ok(fs.existsSync(path.join(ROOT, 'api/index.js')));
      assert.equal(vercel.cleanUrls, undefined, 'links keep their .html addresses');
    });

    it('publishes only the pages and assets', () => {
      assert.equal(vercel.outputDirectory, 'public');
      assert.match(vercel.buildCommand, /cp -r index\.html assets pages public\/$/);
      for (const name of ['server', 'data', 'docs', '.env', 'node_modules']) {
        assert.equal(vercel.buildCommand.includes(` ${name}`), false, `${name} is not copied`);
      }
    });

    it('contains no secrets and the frontend calls the API by a relative address', () => {
      const text = JSON.stringify(vercel);
      assert.equal(/mongodb(\+srv)?:\/\/|JWT_SECRET|password/i.test(text), false);
      const appConfig = fs.readFileSync(path.join(ROOT, 'assets/js/core/app-config.js'), 'utf8');
      assert.match(appConfig, /REMOTE_API_BASE_URL \|\| '\/api'/);
      assert.match(appConfig, /const REMOTE_API_BASE_URL = '';/);
      const frontend = ['assets/js/core/app-config.js', 'assets/js/core/api.js', 'assets/js/core/config.js']
        .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
      assert.equal(/mongodb(\+srv)?:\/\//.test(frontend), false);
    });

    it('keeps .env files, build output and Vercel link data out of Git', () => {
      const ignored = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/);
      for (const entry of ['.env', 'node_modules/', '.vercel', 'public/']) assert.ok(ignored.includes(entry), entry);
    });
  });
});
