# ARCHITECTURE.md — FreshHire Technical Architecture

> **Full-stack since Phase 15.** A static frontend (HTML pages, CSS, JavaScript ES modules) talks over
> HTTP to an Express REST API, which stores everything in MongoDB.
> Phases 0–14 built a frontend-only simulation that kept its data in the browser; that design is
> described in the Git history and in `PROJECT_STATUS.md`.

---

## 1. High-Level Architecture

```
┌──────────────────────── Browser (static site on Netlify) ────────────────────────┐
│  HTML page ──loads──▶ page script (assets/js/pages/<role>/<page>.js)              │
│                              │                                                    │
│                              ▼                                                    │
│                 components (navbar, toast, modal, job-card, charts, …)            │
│                              │                                                    │
│                              ▼                                                    │
│        services (job, application, profile, admin, …): API calls + form rules     │
│                              │                                                    │
│                              ▼                                                    │
│        core:  api.js ── fetch ──▶  auth.js · storage.js · config.js · utils.js    │
│                 │                        │                                        │
│                 │                        ▼                                        │
│                 │              sessionStorage: login token, job filters, flash    │
└─────────────────┼─────────────────────────────────────────────────────────────────┘
                  │  HTTPS, JSON, "Authorization: Bearer <token>"   (CORS: this origin only)
                  ▼
┌──────────────────────── Express API (Node.js on Render) ─────────────────────────┐
│  helmet → CORS → rate limit → JSON body (100 KB) → routes                         │
│  routes        which role may call what (authenticate, requireRole, …)            │
│  controllers   read the request, call a service, send { ok, data }                │
│  validators    input rules; build whitelisted, normalised values                  │
│  services      business rules, ownership checks, notifications                    │
│  models        Mongoose schemas + indexes                                         │
│  error handler every failure → { ok: false, code, error, fieldErrors? }           │
└─────────────────┬─────────────────────────────────────────────────────────────────┘
                  ▼
        MongoDB Atlas:  users · jobs · applications · savedjobs · notifications · resumes
```

**Frontend layer rules**
- Pages → may use components, services, core `auth` / `utils` / `config`.
- Components → may use core `utils` / `config`; they do not call the API.
- Services → may use core `api` / `utils` / `config`; they never touch the DOM.
- `core/api.js` is the **only** module that calls `fetch()`. `core/storage.js` is the **only** module
  that touches `sessionStorage`. Nothing uses `localStorage`.
- Exceptions: the app navbar's Log out action calls `auth.logout()` and `storage.setFlash()`;
  `components/app-shell.js` runs page start-up (`auth.requireRole`, `storage.consumeFlash`, unread
  count); `components/save-button.js` calls `saved-job-service`; `components/file-viewer.js` shows a
  toast when a file cannot be fetched.

**Backend layer rules**
- Routes declare protection and nothing else. Controllers contain no business rules and no queries.
- Only services (and the models they use) talk to the database.
- Validators never read the database; they return messages or whitelisted values.
- The acting user is always `req.user`, loaded from the database by `middleware/auth.js`. An id, role
  or owner sent by the client is never used to decide who is acting.
- Only `config/env.js` reads `process.env`.

## 2. Folder Structure

```
Job-portal/                       (repository root)
├── index.html                    Landing page (public)
├── pages/
│   ├── auth/        login.html, register.html
│   ├── student/     dashboard, jobs, job-details (?id=), applications, saved-jobs, profile
│   ├── recruiter/   dashboard, post-job (?id= → edit), my-jobs, applicants (?jobId=), company-profile
│   ├── admin/       dashboard, users, jobs, announcements, reports
│   └── shared/      notifications.html (any logged-in role)
├── assets/
│   ├── css/         variables, base, layout, components, utilities, pages/*.css
│   ├── images/      logo.svg
│   └── js/
│       ├── core/
│       │   ├── app-config.js     API address for local and deployed use (the one setting to edit)
│       │   ├── api.js            Every API request: token, JSON, errors, expired sessions
│       │   ├── auth.js           login, register, logout, current user, page guards
│       │   ├── storage.js        sessionStorage helpers + one-time flash message
│       │   ├── config.js         Roles, statuses, limits, page paths, storage keys
│       │   └── utils.js          Dates, formatting, validation helpers, paths
│       ├── services/
│       │   ├── user-service.js          Registration form rules, profile completeness reader
│       │   ├── job-service.js           Job search and recruiter job API calls, job form rules
│       │   ├── application-service.js   Apply / track / withdraw / recruiter review API calls
│       │   ├── saved-job-service.js     Saved jobs API calls
│       │   ├── profile-service.js       Profile sections, resume, company profile
│       │   ├── notification-service.js  Notification API calls, safe links
│       │   ├── dashboard-service.js     Student and recruiter dashboards (one request each)
│       │   ├── admin-service.js         Admin API calls, admin form rules
│       │   └── analytics-service.js     Report labels and CSV export
│       ├── components/           app-shell, navbar, sidebar, footer, toast, modal, job-card,
│       │                         pagination, tabs, charts, save-button, resume-sheet,
│       │                         approval-banner, scroll-region, form-field, empty-state, icons,
│       │                         load-state (loading / error states), server-status (slow-server
│       │                         notice), file-viewer (private PDF view / download)
│       └── pages/                one script per HTML page, same name
├── data/                         Demo data (JSON) — input for the seed script, not served
│   ├── users.json  jobs.json  applications.json  notifications.json
├── server/                       The API
│   ├── package.json              Dependencies and npm scripts
│   ├── .env.example              Every environment variable, with placeholders
│   ├── src/
│   │   ├── server.js             Connect to MongoDB, listen on PORT
│   │   ├── app.js                Build the Express app (middleware order, /api router)
│   │   ├── config/               env.js (configuration), database.js (connection + indexes),
│   │   │                         constants.js (roles, statuses, limits)
│   │   ├── models/               user, job, application, saved-job, notification, resume
│   │   ├── validators/           auth, job, profile, admin (+ application form)
│   │   ├── services/             auth, job, application, saved-job, profile, notification,
│   │   │                         analytics, admin, seed
│   │   ├── controllers/          auth, public, student, recruiter, admin, notification
│   │   ├── routes/index.js       Every route and its protection
│   │   ├── middleware/           auth (token, role, approval, id check), error-handler,
│   │   │                         rate-limiters, request-logger
│   │   ├── utils/                app-error, async-handler, serializers, pagination, dates, text
│   │   └── scripts/              seed.js (import demo data), dev-memory.js (zero-setup local demo)
│   └── tests/                    API tests (node:test + supertest + in-memory MongoDB)
├── netlify.toml                  Netlify: what to publish, security headers
├── render.yaml                   Render Blueprint: commands, health check, environment variables
├── .gitignore                    node_modules, .env, dist
├── DEPLOYMENT.md                 Atlas, Render and Netlify, step by step
└── docs/                         API.md, SECURITY.md, and the Phase 14 submission material
```

**Rules**
- One page script per HTML page, same base name.
- Backend code lives only in `server/`. The frontend has no `package.json` and no build tool.
- No other top-level folders without updating this document first.

## 3. Page Inventory

| Page | Path | Access |
|---|---|---|
| Landing | `index.html` | Public |
| Login / Register | `pages/auth/login.html`, `register.html` | Public |
| Student Dashboard, Browse Jobs, Job Details, Saved Jobs, My Applications, Profile & Resume | `pages/student/*.html` | Student |
| Recruiter Dashboard, Post / Edit Job, My Jobs, Applicants, Company Profile | `pages/recruiter/*.html` | Recruiter (job and applicant actions need an `active` account) |
| Admin Dashboard, Users, Moderate Jobs, Announcements, Reports | `pages/admin/*.html` | Admin |
| Notifications | `pages/shared/notifications.html` | Any logged-in role |

"Access" is what the page guard shows. The data behind every page is protected separately by the API
(§5).

## 4. Data Storage

### 4.1 MongoDB (authoritative)

| Collection | Model | Contents | Indexes |
|---|---|---|---|
| `users` | `models/user.js` | Account, bcrypt password hash, status, token version; embedded `studentProfile` or `recruiterProfile` | unique `email` (stored lower-case); `{ role, status, createdAt }` |
| `jobs` | `models/job.js` | Job posting, owner (`recruiter`), status, deadline | `{ recruiter, postedAt }`; `{ status, deadlineAt, postedAt }`; `{ status, annualPay }` |
| `applications` | `models/application.js` | Job, student, cover note, status, status history | **unique `{ student, job }`**; `{ student, updatedAt }`; `{ job, appliedAt }` |
| `savedjobs` | `models/saved-job.js` | Student ↔ job link | **unique `{ student, job }`**; `{ student, savedAt }` |
| `notifications` | `models/notification.js` | One per recipient | `{ user, createdAt }`; `{ user, read }`; `{ type, createdAt }` |
| `resumes` | `models/resume.js` | One PDF per student (bytes) | unique `student` |

- **Identifiers** are MongoDB ObjectIds, sent to the frontend as 24-character strings in `id`,
  `jobId`, `studentId`, `userId`, `recruiterId`. Records imported from the JSON files also keep their
  original id in `legacyId` (unique, sparse), which is what makes the seed script repeatable.
- **References, not copies.** An application stores the job id and the student id only; the recruiter
  is always found through the job. A deleted job leaves its applications and saved links in place as
  history ("Job no longer available") — the application layer handles the missing reference.
- **Derived fields** on a job (`deadlineAt`, `annualPay`, a maximum pay not below the minimum) are
  recalculated from the recruiter's own fields on every save, only so MongoDB can filter and sort.
  "Expired" is never stored: it is `deadlineAt < now`.
- **Indexes are created explicitly** right after connecting (`config/database.js`), so the unique
  constraints are in force before the first request.
- **Resumes** are stored as bytes in MongoDB (500 KB limit each) so the free deployment needs no
  separate file storage. They are served only through authorised routes, never from a public URL.

### 4.2 Browser `sessionStorage` (per tab, convenience only)

| Key | Contents |
|---|---|
| `fh_session` | `{ token, userId, role, name, loginAt }` — the login token and who is logged in |
| `fh_job_filters` | Last used job search filters / sort / page |
| `fh_flash` | One-time message for the next page (e.g. "Account created") |

Keys are defined once in `assets/js/core/config.js`. `localStorage` is not used. Changing these values
in DevTools changes nothing on the server: the role and user in `fh_session` are only hints for the
interface, and every request is checked against the token.

### 4.3 Seed data

`data/*.json` holds the demo data. `npm run seed` (`server/src/scripts/seed.js` →
`services/seed-service.js`) imports it:
users are matched by `legacyId` or email, other records by `legacyId`, and a record is created only
when it is missing — nothing is updated or deleted. Legacy ids are mapped to ObjectIds so users, jobs,
applications and notifications keep their relationships. Plain-text passwords in the JSON are hashed
with bcrypt before storing. The server never seeds by itself.

## 5. Authentication & Authorization

### Login (bearer token)

1. `POST /api/auth/login` checks the email and bcrypt hash and returns a JWT (HS256) signed with
   `JWT_SECRET`, valid for `JWT_EXPIRES_IN` (2 hours), containing the user id, role and token version.
2. The frontend keeps the token in `sessionStorage` and sends it as `Authorization: Bearer <token>`.
3. `middleware/auth.js` verifies the signature and expiry, then **loads the user from the database**
   and refuses the token if the user is gone, blocked, has another role, or has a newer token version.
4. `POST /api/auth/logout` increases the user's token version, so every token issued before stops
   working; the frontend then removes it from the tab.

**Why a token and not a cookie:** the frontend (Netlify) and the API (Render) are on different sites.
A session cookie would be a third-party cookie, which browsers increasingly block, and would need
CSRF protection. A token in a header needs neither, and CORS stays simple (`credentials` off). The
cost is that page scripts can read the token — see `docs/SECURITY.md`.

### Authorization (on the server, for every request)

| Check | Where |
|---|---|
| Logged in, account not blocked | `authenticate` |
| Role | `requireRole(...)` on each router |
| Recruiter approved (`active`) for job and applicant actions (BR-07) | `requireActiveRecruiter` |
| Ownership — own profile, own applications, own saved jobs, own notifications, own jobs, applications to own jobs | services: every query includes the authenticated user's id |
| State — pending-only approval, allowed status steps, withdraw rules | services: conditional updates (`findOneAndUpdate` with the expected current status) |

A record that exists but belongs to someone else is answered exactly like one that does not exist
(404), so ids cannot be probed.

### Page guards (in the browser, for presentation)

`components/app-shell.js` → `auth.requireRole(...roles)` asks `GET /api/auth/me`:
- no valid session → `pages/auth/login.html?returnTo=<this page>` with a "Please log in" message;
- wrong role → the user's own dashboard with a warning;
- the API answers 401 later (token expired, logged out elsewhere, blocked) → `core/api.js` clears
  the session and goes to the login page.

Protected pages start with `[data-app-shell]` hidden and are shown only after the guard passes.
`returnTo` is trusted only for a project page in the user's own role folder or `pages/shared/`.

### Paths
All links use **relative paths**, never root-absolute ones, so the site works from any base URL.
`utils.toRoot(path)` resolves a project-root-relative path from `import.meta.url`.

## 6. Request Lifecycle

```js
// assets/js/pages/student/saved-jobs.js (pattern for protected pages)
async function init() {
  const student = await initProtectedPage(ROLES.STUDENT); // GET /auth/me, guard, navbar, sidebar
  if (!student) return;                                    // a redirect has started
  renderLoading(listEl, 'Loading your saved jobs…');
  const result = await getSavedJobs();                     // service → core/api.js → GET /api/student/saved-jobs
  if (!result.ok) { renderLoadError(listEl, { title: '…', message: result.error }); return; }
  render(result.data.items);
}
```

Every service call is asynchronous and resolves to `{ ok: true, data }` or
`{ ok: false, code, error, fieldErrors? }` — the same shape the API sends — so pages handle a failed
rule, a validation error and a network error the same way and never need `try / catch` for HTTP.
Lists that follow a search field carry a request number, so a slow older answer cannot overwrite a
newer one.

On the server, `POST /api/jobs/:jobId/applications` runs:
`authenticate` → `requireRole('student')` → `validateIdParam` → `student-controller.applyToJob` →
`application-service.applyToJob` (job approved? deadline? already applied? eligible? cover note?) →
`Application.create` (the unique index refuses a duplicate that slipped past the check) →
`notification-service.createNotification` for the job's recruiter → `201 { ok: true, data }`.

## 7. Main Workflows

| Workflow | Frontend service → API route → server service |
|---|---|
| Register / login / logout | `core/auth` → `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me` → `auth-service` |
| Landing | `job-service.getLandingData` → `GET /public/landing` → `job-service.getLandingData` |
| Browse jobs | `job-service.searchJobs`, `getJobFilterOptions` → `GET /jobs`, `/jobs/filter-options` — search, filters, sort and paging run in MongoDB |
| Job details, apply | `getJobDetails`, `applyToJob` → `GET /jobs/:id`, `POST /jobs/:id/applications` → `application-service` |
| My applications, withdraw | `getOwnApplications`, `withdrawApplication` → `/student/applications…` |
| Saved jobs | `saved-job-service` → `GET/PUT/DELETE /student/saved-jobs…` |
| Profile, resume | `profile-service` → `PATCH /student/profile/:section`, `GET/PUT/DELETE /student/resume` |
| Recruiter jobs | `job-service` → `/recruiter/jobs…` (create `pending`; core edits return to `pending`; close) |
| Applicants | `application-service` → `/recruiter/jobs/:id/applications`, `/recruiter/applications/:id…` |
| Admin | `admin-service` → `/admin/dashboard`, `/admin/users…`, `/admin/jobs…`, `/admin/announcements`, `/admin/reset-demo-data` |
| Notifications | created inside the server service that made the change; read through `/notifications…` |
| Analytics | counted on the server per request: student breakdown and recruiter funnel arrive with the dashboards; `GET /admin/reports` for the admin; charts and CSV are drawn in the browser from those numbers |

Job lifecycle: `pending` → admin `approved` / `rejected` (reason) → recruiter may `close` an approved
job. Application lifecycle: `applied → under_review → shortlisted → interview → selected`, or
`rejected` from any of these (recruiter); `withdrawn` from `applied` / `under_review` (student). Every
change is appended to `statusHistory`.

The full endpoint list is in `docs/API.md`.

## 8. Configuration

| Where | Setting | Purpose |
|---|---|---|
| `assets/js/core/app-config.js` | `PRODUCTION_API_BASE_URL` | The deployed API address (public; the only frontend setting) |
| Server environment | `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV`, `PORT`, `JWT_EXPIRES_IN`, `APP_TIMEZONE_OFFSET_MINUTES`, `AUTH_RATE_LIMIT_MAX`, `ALLOW_DEMO_RESET`, `SERVE_FRONTEND` | See `server/.env.example` |

On `localhost` the frontend calls the API on port 5000 automatically. In production the server
refuses to start without `MONGODB_URI`, a `JWT_SECRET` of at least 32 characters and `FRONTEND_URL`.
Secrets exist only in environment variables — never in the repository or in any frontend file.

Deadlines are calendar dates; a deadline day ends at midnight in the application's time zone
(`APP_TIMEZONE_OFFSET_MINUTES`, default India), wherever the server runs.

## 9. Running and Deploying

- Local: `README.md` ("Run it on your computer").
- Deployment on Netlify + Render + MongoDB Atlas: `DEPLOYMENT.md`.
