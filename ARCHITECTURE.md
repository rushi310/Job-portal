# ARCHITECTURE.md — FreshHire Technical Architecture

> **Frontend-only.** FreshHire is a set of static HTML pages, CSS files, JavaScript ES modules, and JSON seed files.
> Everything runs in the browser. There is no server-side code, no database, and no API.

---

## 1. High-Level Architecture

```
┌──────────────────────────────── Browser ────────────────────────────────┐
│                                                                          │
│   HTML pages  ──loads──▶  Page script (assets/js/pages/<role>/<page>.js) │
│                                   │                                      │
│                                   ▼                                      │
│                  Components (navbar, toast, modal, job-card, ...)        │
│                                   │                                      │
│                                   ▼                                      │
│      Services (user, job, application, saved-job, notification,          │
│                analytics)  — all business rules live here                │
│                                   │                                      │
│                                   ▼                                      │
│      Core (config, storage, auth, seed, utils)                           │
│             │                              │                             │
│             ▼                              ▼                             │
│      localStorage (fh_*)            sessionStorage (fh_session, ...)     │
│             ▲                                                            │
│             │  first run only: fetch()                                   │
│      /data/*.json  (static seed files served with the site)              │
└──────────────────────────────────────────────────────────────────────────┘
```

**Layer rules**
- Pages → may use components, services, core `auth`/`utils`/`config`.
- Components → may use core `utils`/`config`; they never read storage.
- Services → may use core `storage`/`utils`/`config`; they never touch the DOM.
- Core `storage` is the **only** module that calls `localStorage` / `sessionStorage` APIs.
- Exception: core `auth` uses `user-service` to look up accounts (user-service never imports auth, so there is no cycle).
- Exception: the app navbar's Log out action calls `auth.logout()` and `storage.setFlash()` (it still never reads storage itself).
- Exception: `components/app-shell.js` runs page start-up for protected pages (`ensureSeeded`, `auth.requireRole`, `storage.consumeFlash`).
- Exception: `components/save-button.js` calls `saved-job-service` (save/unsave), so every page shares one save toggle.

## 2. Folder Structure

```
Job portal/                     (project root)
├── index.html                  Landing page (public)
├── CLAUDE.md
├── PROJECT_STATUS.md
├── DEVELOPMENT_PHASES.md
├── PROJECT_SPEC.md
├── ARCHITECTURE.md
├── UI_SPEC.md
├── CODING_RULES.md
├── README.md
│
├── pages/
│   ├── auth/
│   │   ├── login.html
│   │   └── register.html
│   ├── student/
│   │   ├── dashboard.html
│   │   ├── jobs.html
│   │   ├── job-details.html        (?id=<jobId>)
│   │   ├── applications.html
│   │   ├── saved-jobs.html
│   │   └── profile.html
│   ├── recruiter/
│   │   ├── dashboard.html
│   │   ├── post-job.html           (?id=<jobId> → edit mode)
│   │   ├── my-jobs.html
│   │   ├── applicants.html         (?jobId=<jobId>)
│   │   └── company-profile.html
│   ├── admin/
│   │   ├── dashboard.html
│   │   ├── users.html
│   │   ├── jobs.html
│   │   ├── announcements.html
│   │   └── reports.html
│   └── shared/
│       └── notifications.html      (any logged-in role)
│
├── assets/
│   ├── css/
│   │   ├── variables.css           Design tokens (colors, spacing, fonts, radii, shadows)
│   │   ├── base.css                Reset + element defaults + typography
│   │   ├── layout.css              Header, sidebar, app shell, grid, containers
│   │   ├── components.css          Buttons, forms, cards, badges, tables, modal, toast, ...
│   │   ├── utilities.css           Small helper classes (spacing, text, visibility)
│   │   └── pages/
│   │       ├── landing.css
│   │       ├── auth.css
│   │       ├── student.css
│   │       ├── recruiter.css
│   │       └── admin.css
│   ├── js/
│   │   ├── core/
│   │   │   ├── config.js           Storage keys, DATA_VERSION, roles, statuses, limits
│   │   │   ├── storage.js          JSON get/set/remove for local & session storage
│   │   │   ├── seed.js             Loads /data/*.json into localStorage on first run
│   │   │   ├── auth.js             register, login, logout, getSession, requireRole
│   │   │   └── utils.js            ids, dates, escapeHtml, validation, debounce, query params, paths
│   │   ├── services/
│   │   │   ├── user-service.js
│   │   │   ├── profile-service.js  The logged-in student's own profile sections and resume (Phase 7)
│   │   │   ├── job-service.js
│   │   │   ├── application-service.js
│   │   │   ├── saved-job-service.js
│   │   │   ├── notification-service.js
│   │   │   └── analytics-service.js
│   │   ├── components/
│   │   │   ├── icons.js            Inline SVG icon set shared by components
│   │   │   ├── form-field.js       Inline field errors, password toggle, loading button
│   │   │   ├── app-shell.js        Protected-page start-up: seed → guard → navbar/sidebar/footer → flash
│   │   │   ├── save-button.js      "♡ Save / ♥ Saved" toggle shared by job cards and Job Details
│   │   │   ├── tabs.js             Accessible tabs (arrow keys, URL hash) — Profile, later Applicants
│   │   │   ├── resume-sheet.js     Printable resume generated from a student profile
│   │   │   ├── navbar.js           Top bar (logo, role menu, bell, user menu)
│   │   │   ├── sidebar.js          Role-based side navigation
│   │   │   ├── footer.js
│   │   │   ├── toast.js
│   │   │   ├── modal.js
│   │   │   ├── job-card.js
│   │   │   ├── pagination.js
│   │   │   ├── empty-state.js
│   │   │   └── charts.js           Canvas/SVG bar, donut, line charts (Phase 11)
│   │   └── pages/
│   │       ├── landing.js
│   │       ├── auth/        login.js, register.js
│   │       ├── student/     dashboard.js, jobs.js, job-details.js, applications.js, saved-jobs.js, profile.js
│   │       ├── recruiter/   dashboard.js, post-job.js, my-jobs.js, applicants.js, company-profile.js
│   │       ├── admin/       dashboard.js, users.js, jobs.js, announcements.js, reports.js
│   │       └── shared/      notifications.js
│   └── images/                     Logo (SVG), illustrations, placeholder avatars
│
├── data/
│   ├── users.json
│   ├── jobs.json
│   ├── applications.json
│   └── notifications.json
│
└── docs/                           Created in Phase 13–14 (test cases, viva notes, screenshots)
```

**Rules**
- One page script per HTML page, same base name (`pages/student/jobs.html` ↔ `assets/js/pages/student/jobs.js`).
- No other top-level folders may be added without updating this document first.
- **No backend folders** (`server/`, `api/`, `backend/`, `routes/`, `models/`, `controllers/`) — ever.
- Folders are created in Phase 1 (empty ones hold a `.gitkeep`); files are created in the phase that needs them (see `DEVELOPMENT_PHASES.md`), not in advance.

## 3. Page Inventory

| Page | Path | Access | Phase |
|---|---|---|---|
| Landing | `index.html` | Public | 1 |
| Login | `pages/auth/login.html` | Public | 2 |
| Register | `pages/auth/register.html` | Public | 2 |
| Student Dashboard | `pages/student/dashboard.html` | Student | 3 |
| Browse Jobs | `pages/student/jobs.html` | Student | 4 |
| Job Details | `pages/student/job-details.html` | Student | 5 |
| Saved Jobs | `pages/student/saved-jobs.html` | Student | 6 |
| My Applications | `pages/student/applications.html` | Student | 6 |
| Profile & Resume | `pages/student/profile.html` | Student | 7 |
| Recruiter Dashboard | `pages/recruiter/dashboard.html` | Recruiter | 8 |
| Post / Edit Job | `pages/recruiter/post-job.html` | Recruiter (`active`) | 8 |
| My Jobs | `pages/recruiter/my-jobs.html` | Recruiter | 8 |
| Applicants | `pages/recruiter/applicants.html` | Recruiter | 8 |
| Company Profile | `pages/recruiter/company-profile.html` | Recruiter | 8 |
| Admin Dashboard | `pages/admin/dashboard.html` | Admin | 9 |
| Manage Users | `pages/admin/users.html` | Admin | 9 |
| Moderate Jobs | `pages/admin/jobs.html` | Admin | 9 |
| Announcements | `pages/admin/announcements.html` | Admin | 10 |
| Notifications | `pages/shared/notifications.html` | Any logged-in | 10 |
| Reports | `pages/admin/reports.html` | Admin | 11 |

The three dashboards first appear in Phase 2 as minimal shells (welcome + logout) so login redirects work; the Phase column shows when each is fully built.
Analytics for students and recruiters (Phase 11) are added as sections on their existing dashboards — no new pages.

## 4. Storage Design

All keys are defined once in `assets/js/core/config.js` in a `STORAGE_KEYS` object.

### 4.1 localStorage (persistent, per browser)

| Key | Type | Contents |
|---|---|---|
| `fh_data_version` | string | Version of seed data currently loaded |
| `fh_users` | array | All users (see PROJECT_SPEC §5.1) |
| `fh_jobs` | array | All jobs (§5.2) |
| `fh_applications` | array | All applications (§5.3) |
| `fh_saved_jobs` | array | Saved-job records (§5.4) |
| `fh_notifications` | array | Notifications (§5.5) |

### 4.2 sessionStorage (per tab, cleared on close)

| Key | Type | Contents |
|---|---|---|
| `fh_session` | object | Logged-in user session (§5.6) |
| `fh_job_filters` | object | Last used job search filters/sort/page (restored when returning to Browse Jobs) |
| `fh_flash` | object | One-time message shown on the next page (e.g. "Registered successfully") |

### 4.3 Seeding Flow (`core/seed.js`)
```
page loads → ensureSeeded()
   ├─ fh_data_version === DATA_VERSION ? → done
   └─ else → fetch data/users.json, jobs.json, applications.json, notifications.json
             → write fh_users, fh_jobs, fh_applications, fh_notifications
             → write fh_saved_jobs = []
             → write fh_data_version = DATA_VERSION
```
Every page script awaits `ensureSeeded()` before doing anything else. Admin "Reset demo data" removes all `fh_` keys and calls `ensureSeeded()` again.

## 5. Authentication & Routing

- **No router library.** Each page is a separate HTML file; navigation is normal links.
- `auth.login(email, password)` → validates against `fh_users` → writes `fh_session` → redirects to the role's dashboard.
- `auth.requireRole(...roles)` is the first call in every protected page script (via `components/app-shell.js`):
  - no session → redirect to `pages/auth/login.html?returnTo=<this page>` with a "Please log in" flash
  - session role not allowed → redirect to the user's own dashboard with a warning flash
  - user no longer exists or is `blocked` → clear session → login
  - redirects use `location.replace`, and a role's own dashboard always accepts that role, so redirects cannot loop
- After login, `auth.getPostLoginPath(role, returnTo)` returns `returnTo` only if it is a project page in the user's own role folder or `pages/shared/`; otherwise the role dashboard.
- `auth.logout()` → removes `fh_session`; the navbar then redirects to `index.html`.
- Public pages (landing, login, register) call `auth.redirectIfLoggedIn()` to send an already-logged-in user to their dashboard.
- Protected pages start with their `[data-app-shell]` wrapper `hidden`; it is shown only after the guard passes.

### Paths
All links and redirects use **relative paths** — never root-absolute paths (`/pages/...`) — so the site works from any base URL (Live Server, a sub-folder, or GitHub Pages). `utils.js` exposes a `toRoot(path)` helper that resolves a root-relative project path using `import.meta.url`.

## 6. Page Script Lifecycle

```js
// assets/js/pages/student/jobs.js (pattern for protected pages)
import { ROLES } from '../../core/config.js';
import { initProtectedPage } from '../../components/app-shell.js';

async function init() {
  // seeds data, runs requireRole, renders navbar + sidebar + footer, shows flash message
  const user = await initProtectedPage(ROLES.STUDENT);
  if (!user) return;               // redirect already happening
  // read data via services, render, bind events
}

init();
```
Each HTML page loads exactly one script: `<script type="module" src="..."></script>`.

## 7. Services (business logic)

| Service | Responsibilities |
|---|---|
| `user-service.js` | find/create/update users, email uniqueness, status changes, profile completeness |
| `profile-service.js` | the logged-in student's profile edits (per tab, whitelisted fields, validation) and resume upload/replace/remove/view; student always from the session. Sits above `auth` and `user-service` so neither imports the other in a cycle |
| `job-service.js` | CRUD jobs, search/filter/sort/paginate, approval, close, expiry check |
| `application-service.js` | apply (with eligibility + duplicate checks), withdraw, status transitions, history |
| `saved-job-service.js` | toggle/list saved jobs |
| `notification-service.js` | create, list, mark read, unread count, broadcast |
| `analytics-service.js` | aggregate counts for dashboards and reports; CSV export data |

Services return plain objects/arrays or `{ ok: true, data }` / `{ ok: false, error }` for operations that can fail.

Services are created with the read-only queries the current phase needs and grow in later phases (e.g. `application-service`, `saved-job-service` and `notification-service` were added in Phase 3 with read-only queries for the student dashboard; their write operations arrive in Phases 5, 6 and 10). There is no separate dashboard service: dashboard pages compose these services. Phase 7 added `profile-service.js` (`updateProfileSection`, `validateProfileField`, `validateNewSkill`, `uploadResume`, `removeResume`, `getResumeInfo`, `getOwnResumeFile`; file reading uses the browser `FileReader`/`Blob` APIs, never the DOM), `updateStudentRecord` in `user-service` (only `name`, `phone`, `profile` can change), and `components/tabs.js` + `components/resume-sheet.js`. Phase 6 added `saveJob`, `unsaveJob`, `isJobSaved`, `getSavedJobsWithDetails` to `saved-job-service`, `canWithdraw` / `withdrawApplication` to `application-service`, `getJobAvailability` to `job-service`, and `components/save-button.js`; all writes take the student from the session. Phase 5 added `getVisibleJob(id)` to `job-service` and `checkEligibility`, `getApplyStatus`, `validateApplicationForm` and `applyToJob` to `application-service`; `applyToJob` takes the student from `auth.getCurrentUser()` (core), never from a parameter, and re-checks every rule before writing. Phase 4 added `searchJobs(criteria)` and `getJobFilterOptions()` to `job-service` (pure functions over derived arrays; stored jobs are never modified), `paginate()` to `utils.js`, and `components/pagination.js`.

## 8. Running the Project

Because ES modules and `fetch()` are blocked on the `file://` protocol, the project must be opened through a **static file server**:
- **Recommended:** VS Code → install "Live Server" extension → right-click `index.html` → "Open with Live Server".
- Any other static server works too. The server only delivers files; it executes no project code and is not part of the project.

## 9. Deployment (optional)
The folder can be published as-is to any static host (e.g. GitHub Pages). No build step is required.
