# FreshHire

A job portal for freshers — final-year college project.

Students find entry-level jobs and internships, apply and track their applications. Recruiters post
jobs and review applicants. An admin approves recruiters and jobs, manages users, sends announcements
and reads reports.

FreshHire is a **full-stack** application:

| Part | Technology | Hosting (free tier) |
|---|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES modules) — no framework, no build tool | Vercel (static files) |
| Backend | Node.js, Express REST API | Vercel (one Function, same project and domain) |
| Database | MongoDB (through Mongoose) | MongoDB Atlas |

> **Academic demo, not a real hiring service.** It has real logins, server-side permissions and a real
> database, but it is not hardened or monitored like a production system. Do not enter real personal
> data. See [docs/SECURITY.md](docs/SECURITY.md).

The project started as a frontend-only simulation (data in the browser's `localStorage`) and was
migrated to this full-stack form in Phase 15. The history is kept in
[PROJECT_STATUS.md](PROJECT_STATUS.md).

---

## Status

| Area | State |
|---|---|
| Backend API, database models, authentication, authorization | Implemented and tested (94 automated API tests) |
| Frontend connected to the API (all 20 pages) | Implemented and tested in a browser (92 end-to-end checks, Microsoft Edge) |
| Vercel set-up (`vercel.json`, `api/index.js`, root `package.json`) | Prepared and checked locally against a stand-in for Vercel's routing; **not deployed** |
| Live deployment on Vercel + Atlas | **Needs your accounts** — follow [DEPLOYMENT.md](DEPLOYMENT.md) |

Details, limits and what was not verified: [PROJECT_STATUS.md](PROJECT_STATUS.md) (Phase 15).

## Features

**Everyone:** landing page with open jobs, registration (student or recruiter), login.

**Student:** dashboard (stats, profile completeness, recent applications, status chart, recommended
jobs); browse jobs with search, filters, sorting and pagination; job details with an eligibility
check; apply with a cover note; save jobs; track applications with a status timeline; withdraw;
profile in five tabs; PDF resume upload (up to 500 KB) and a printable generated resume; notifications.

**Recruiter:** approval banner until an admin approves the account; dashboard with applicant charts;
post / edit / close jobs; applicants per job with status changes, candidate profile and resume;
company profile; notifications.

**Admin:** dashboard totals and approval queues; users (search, filter, approve, block, unblock,
delete); jobs (view, approve, reject with a reason, delete); announcements; reports with charts,
tables and CSV export; notifications.

Business rules are in [PROJECT_SPEC.md](PROJECT_SPEC.md); every one of them is enforced on the server.

## Run it on your computer

You need [Node.js](https://nodejs.org/) 16.20.1 or newer and Git. (The project was developed and tested on
Node 16.20; Vercel runs it on Node 22 or 24, which was not tested here.)

### Option A — quickest: everything in one command, no database to install

```bash
cd server
npm install
npm run dev:memory
```

Open <http://localhost:5000/>. This starts a temporary in-memory MongoDB, loads the demo data and
serves both the API and the pages. **Data is lost when you stop it** (Ctrl+C). The first run
downloads a MongoDB program of about 500 MB.

### Option B — with a real database (data is kept)

1. Get a MongoDB connection string: a free MongoDB Atlas cluster
   ([DEPLOYMENT.md](DEPLOYMENT.md) §1) or MongoDB installed on your computer.
2. Configure the API:

   ```bash
   cd server
   npm install
   cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
   ```

   Edit `server/.env`: set `MONGODB_URI` and `JWT_SECRET` (the file explains each value). Set
   `SERVE_FRONTEND=true` if you want the API to serve the pages too.
3. Load the demo data once, then start the API:

   ```bash
   npm run seed
   npm run dev
   ```

4. Open the pages:
   - with `SERVE_FRONTEND=true`: <http://localhost:5000/>
   - or with the VS Code **Live Server** extension: right-click `index.html` → *Open with Live
     Server* (port 5500). The pages then call the API on port 5000.

   The pages cannot be opened by double-clicking a file (`file://`): browsers block ES modules there.

### Commands (run inside `server/`)

| Command | What it does |
|---|---|
| `npm run dev:memory` | Temporary database + demo data + API + pages on port 5000 |
| `npm run dev` | Start the API (uses `server/.env`) |
| `npm run dev:watch` | Same, restarting when a file changes (Node 18.11+) |
| `npm start` | Start the API as on the server (production) |
| `npm run seed` | Import the demo data — only adds what is missing, never overwrites or deletes |
| `npm test` | Run the API tests against a private in-memory database |

## Demo accounts

Created by `npm run seed` (and by `npm run dev:memory`):

| Role | Email | Password |
|---|---|---|
| Student | student@freshhire.com | Student@123 |
| Recruiter | recruiter@freshhire.com | Recruiter@123 |
| Admin | admin@freshhire.com | Admin@123 — **local only** |

The seed data also contains four more students and four more recruiters (one pending, one blocked);
their password is `Password@123`.

These passwords are public. On a deployed site the admin account must not use the public password:
the seed command refuses to run in production without `SEED_ADMIN_PASSWORD`
([DEPLOYMENT.md](DEPLOYMENT.md) §2). The login page offers the admin shortcut only on `localhost`.

## How it is built

```
Browser (HTML / CSS / JS modules — static files on Vercel)
   │  same domain: /api/…  JSON, "Authorization: Bearer <token>"
   ▼
Express API (a Vercel Function, api/index.js):  routes → controllers → validators + services → Mongoose models
   ▼
MongoDB Atlas
```

- The pages keep **no business data** in the browser. `sessionStorage` holds only the login token,
  the last job filters and a one-time message for the next page.
- Every protected request is checked on the server: valid token, the account's current role and
  status, and ownership of the record. The page guards in the browser only decide what to show.
- Passwords are stored as bcrypt hashes. Tokens last two hours and stop working on logout.

Full description: [ARCHITECTURE.md](ARCHITECTURE.md). Endpoints: [docs/API.md](docs/API.md).

```
index.html, pages/, assets/     the frontend (copied to public/ and published by Vercel)
assets/js/core/app-config.js    where the pages find the API ("/api" on the same domain)
api/index.js                    Vercel Function entry: wraps the Express app in server/
data/*.json                     demo data read by the seed script
server/                         the API (also runs on its own locally: npm run dev)
  src/  config · models · validators · services · controllers · routes · middleware · scripts
  tests/                        API tests
vercel.json, package.json       Vercel settings and the dependency list Vercel installs
netlify.toml, render.yaml       settings for the alternative Netlify + Render hosting
docs/                           API, security, user guide, report, viva material
```

## Deployment

Step-by-step guide for MongoDB Atlas and Vercel (pages and API in one project):
**[DEPLOYMENT.md](DEPLOYMENT.md)**. The earlier Netlify + Render arrangement is in
[DEPLOYMENT_NETLIFY_RENDER.md](DEPLOYMENT_NETLIFY_RENDER.md).
Nothing has been deployed for you; the guide marks what is already prepared in the repository and
what you do in your own accounts.

## Testing

- **API tests** (`cd server && npm test`): 94 tests in 7 files covering the Vercel entry point, authentication,
  authorization and ownership, jobs, applications, saved jobs, profile and resume, notifications,
  admin workflows, analytics, the seed import and deployment readiness (health check, CORS,
  configuration, error format). They run against an in-memory MongoDB, never a real database. The
  first run downloads the same ~500 MB MongoDB program as `dev:memory`.
- **Browser check:** the complete journey of all three roles was driven through the real pages in
  headless Microsoft Edge against the real API (92 checks): same-origin, cross-origin, and against a
  clean copy built the way Vercel builds it (root install, build command, `vercel.json` routing and headers). That script used a browser driver outside the project
  and is not in the repository.

What each run covered, and what was *not* tested (other browsers, a live deployment), is recorded in
[PROJECT_STATUS.md](PROJECT_STATUS.md).

## Known limitations

- Not production-secure: no email verification, no password reset, no account lockout beyond rate
  limiting, the login token lives in `sessionStorage` (readable by any script on the page).
- Free hosting: the API sleeps when idle and takes up to about a minute to answer the first request;
  the free database is small (resumes are stored in it, 500 KB each).
- No email or SMS; notifications exist only inside the app and appear on the next page load.
- A login lasts for the browser tab: closing the tab logs out; tokens expire after two hours.
- Minimum supported width 360px. Tested in Microsoft Edge only after the migration.

More: [docs/SECURITY.md](docs/SECURITY.md), [DEPLOYMENT.md](DEPLOYMENT.md) §6.

## Documents

| File | Contents |
|---|---|
| [PROJECT_SPEC.md](PROJECT_SPEC.md) | Features, roles, business rules, data models |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Structure, layers, request flow, storage |
| [docs/API.md](docs/API.md) | Every API endpoint |
| [docs/SECURITY.md](docs/SECURITY.md) | What is protected, how, and what is not |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Atlas and Vercel, step by step (alternative: [Netlify + Render](DEPLOYMENT_NETLIFY_RENDER.md)) |
| [UI_SPEC.md](UI_SPEC.md), [CODING_RULES.md](CODING_RULES.md) | Design system and code conventions |
| [DEVELOPMENT_PHASES.md](DEVELOPMENT_PHASES.md), [PROJECT_STATUS.md](PROJECT_STATUS.md) | Plan and progress |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) and other files in `docs/` | User guide, report, viva and demo material (written for the earlier frontend-only version; each file says so at the top) |
