# DEVELOPMENT_PHASES.md — FreshHire Roadmap

> **Frontend-only project.** Every phase uses only HTML5, CSS3, Vanilla JavaScript ES6+, JSON mock data,
> `localStorage`, and `sessionStorage`. No phase introduces a backend, database, framework, or dependency.
>
> **Gating rule:** a phase starts only when the user explicitly approves it. The current phase is recorded in
> `PROJECT_STATUS.md`. At the end of each phase, verify its acceptance criteria, update the status file, report, and stop.

File paths below refer to the structure in `ARCHITECTURE.md`.

---

## Phase 0 — Planning
**Goal:** Define the project completely before any code is written.

**Deliverables**
- `CLAUDE.md`, `PROJECT_STATUS.md`, `DEVELOPMENT_PHASES.md`, `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `UI_SPEC.md`, `CODING_RULES.md`, `README.md`

**Acceptance criteria**
- All eight documents exist and state that the project is frontend-only.
- No contradictions between documents (tech stack, folder structure, storage keys, pages, phases, statuses).
- No application code, pages, backend files, or dependencies exist.
- `PROJECT_STATUS.md` shows Phase 0.

---

## Phase 1 — Project Setup & Base UI
**Goal:** Create the skeleton, design system, core modules, seed data, and the public landing page.

**Deliverables**
- Complete frontend folder structure per `ARCHITECTURE.md` §2 (`docs/` excepted). Folders whose files belong to later phases contain only a `.gitkeep` placeholder.
- CSS: `variables.css`, `base.css`, `layout.css`, `components.css`, `utilities.css`, `pages/landing.css`.
- Core JS: `config.js`, `storage.js`, `utils.js`, `seed.js`.
- Seed data: `data/users.json`, `jobs.json`, `applications.json`, `notifications.json` (per `PROJECT_SPEC.md` §5–6).
- Components: `navbar.js` (public variant), `footer.js`, `toast.js`, `modal.js`, `job-card.js`, `empty-state.js`.
- Service: `job-service.js` with read-only getters needed for the landing page (e.g. latest approved jobs).
- `assets/images/logo.svg`.
- `index.html` + `assets/js/pages/landing.js`: hero, how it works, 6 featured approved jobs, stats strip, footer. Login/Register links shown as disabled "Coming soon" until Phase 2.

**Acceptance criteria**
- Served via Live Server, the landing page loads with no console errors.
- First load seeds all `fh_` localStorage keys; `fh_data_version` matches `DATA_VERSION`.
- Only approved, non-expired jobs appear as featured.
- Toast and modal components work (demonstrated on landing page, e.g. demo notice).
- Layout usable at 360px and 1280px.

---

## Phase 2 — Login & Registration
**Goal:** Simulated authentication with role-based redirects and guards.

**Deliverables**
- `pages/auth/login.html`, `pages/auth/register.html`, `assets/css/pages/auth.css`, and their page scripts (`assets/js/pages/auth/login.js`, `register.js`).
- `core/auth.js` (register, login, logout, getSession, requireRole, redirectIfLoggedIn).
- `services/user-service.js` (create, find by email/id, email uniqueness).
- `components/navbar.js` app variant + `components/sidebar.js` (role-based; unbuilt pages disabled with "Soon").
- **Minimal dashboard shells** for `pages/student/dashboard.html`, `pages/recruiter/dashboard.html`, `pages/admin/dashboard.html`: app shell + "Welcome, <name>" + logout only. (Their full content is built in Phases 3, 8, and 9.)
- Landing page header links to Login/Register enabled.

**Acceptance criteria**
- Student and recruiter registration with full validation (BR-01, BR-02); recruiter created as `pending`.
- Login works for all three demo accounts; blocked users are refused (BR-03).
- Session stored in `sessionStorage` `fh_session`; closing the tab logs out (BR-04).
- Role guard redirects correctly for no session and wrong role (BR-05).
- Logged-in users visiting login/register are sent to their dashboard.
- Logout clears the session and returns to landing.

---

## Phase 3 — Student Dashboard
**Goal:** A useful home screen for students.

**Deliverables**
- Full `pages/student/dashboard.html` + script + `assets/css/pages/student.css`.
- Stat cards (applied, shortlisted, saved, profile completeness), recent applications (from seed data), recommended jobs by skill match.
- Profile completeness calculation in `user-service.js`.
- Service reads needed from `application-service.js` / `saved-job-service.js` (read-only functions only).

**Acceptance criteria**
- Numbers match the logged-in student's data in localStorage.
- Empty states shown for a newly registered student.
- Links to pages not yet built are disabled ("Soon").

---

## Phase 4 — Job Listing & Search
**Goal:** Students can find jobs.

**Deliverables**
- `pages/student/jobs.html` + script; `components/pagination.js`.
- `job-service.js`: search (title, company, skills), filters (location, job type, work mode, salary/stipend range, skills), sort (newest, deadline, salary), pagination (9 per page).
- Filter state persisted in `sessionStorage` `fh_job_filters`.

**Acceptance criteria**
- Only `approved` jobs listed. Expired jobs are hidden by default; a "Show expired" checkbox includes them with an "Expired" badge (BR-12).
- Search is debounced; result count announced via `aria-live`.
- Filters combine correctly; "Clear filters" resets everything.
- Returning to the page restores the last filters within the same tab.

---

## Phase 5 — Job Details & Applications
**Goal:** Students view a job and apply.

**Deliverables**
- `pages/student/job-details.html?id=` + script.
- `application-service.js`: apply, withdraw, eligibility check, duplicate check, status history.
- Apply modal with optional cover note.

**Acceptance criteria**
- Invalid/missing `id` or non-approved job shows a friendly "Job not found" state.
- Eligibility box shows ✓/✗ per rule; Apply disabled when ineligible, expired, or already applied (BR-12–BR-14).
- Successful application stored in `fh_applications` with `statusHistory` (BR-16) and resume reference if present (BR-17).
- Withdraw allowed only from `applied` / `under_review` (BR-15).

---

## Phase 6 — Saved Jobs & Application Tracking
**Goal:** Students manage saved jobs and follow application progress.

**Deliverables**
- `pages/student/saved-jobs.html`, `pages/student/applications.html` + scripts.
- `saved-job-service.js` toggle/list; Save (♡) wired on job cards and job details.
- Applications list with status filter tabs and a timeline component.

**Acceptance criteria**
- Save/unsave toggles consistently across jobs list, details, and saved page (BR-18).
- Applications page shows every application with correct status badge and timeline.
- Withdraw from this page works and updates the timeline.

---

## Phase 7 — Student Profile & Resume
**Goal:** Students maintain a complete profile and resume.

**Deliverables**
- `pages/student/profile.html` + script with tabs: Personal, Education, Skills, Projects & Links, Resume.
- Resume upload (PDF ≤ 500 KB, Base64 in the user's profile), view/download, delete.
- Printable resume generated from profile data (print stylesheet / `window.print()`).

**Acceptance criteria**
- All profile edits persist and update profile completeness on the dashboard.
- Non-PDF or oversize files are rejected with a clear message; quota errors handled.
- Generated resume prints cleanly on A4.

---

## Phase 8 — Recruiter Portal
**Goal:** Recruiters post jobs and manage applicants.

**Deliverables**
- Full `pages/recruiter/dashboard.html`; `post-job.html`, `my-jobs.html`, `applicants.html`, `company-profile.html` + scripts; `assets/css/pages/recruiter.css`.
- `job-service.js`: create, update, close (BR-07–BR-11).
- `application-service.js`: recruiter status transitions (BR-15).

**Acceptance criteria**
- `pending` recruiters see the approval banner and cannot post jobs (BR-07).
- New jobs saved as `pending`; editing core fields of an approved job returns it to `pending`.
- Recruiters see only their own jobs and applicants.
- Status changes follow the allowed flow and are recorded in history.
- Student profile and resume viewable from the applicants page.

---

## Phase 9 — Admin Portal
**Goal:** Admin moderates the platform.

**Deliverables**
- Full `pages/admin/dashboard.html`; `users.html`, `jobs.html` + scripts; `assets/css/pages/admin.css`.
- `user-service.js`: approve recruiter, block/unblock, delete (with cleanup of related jobs/applications/saved jobs).
- `job-service.js`: approve, reject with reason, delete.
- "Reset demo data" in the dashboard danger zone (BR-20).

**Acceptance criteria**
- Admin cannot block or delete their own account.
- Approved recruiters can immediately post jobs; blocked users are logged out on their next page load.
- Approved jobs appear in student search; rejected jobs show the reason to the recruiter.
- Every destructive action requires confirmation.

---

## Phase 10 — Notifications
**Goal:** In-app notifications for all roles.

**Deliverables**
- `notification-service.js`; bell with unread count in the navbar; `pages/shared/notifications.html` + script.
- `pages/admin/announcements.html` + script.
- Notification creation added to existing actions (events in `PROJECT_SPEC.md` §4.5).

**Acceptance criteria**
- Each event in §4.5 creates a notification for the correct recipient(s).
- Unread count updates after marking read; "Mark all as read" works.
- Clicking a notification marks it read and navigates to its link.

---

## Phase 11 — Analytics & Reports
**Goal:** Visual insights using hand-drawn charts.

**Deliverables**
- `components/charts.js` (bar, donut, line) using Canvas or SVG — **no chart libraries**.
- `analytics-service.js`.
- Student dashboard: application status breakdown. Recruiter dashboard: applicants per job, status funnel.
- `pages/admin/reports.html` + script: users by role, jobs by status, applications by status, applications over time; tables; CSV export (Blob download).

**Acceptance criteria**
- Chart values match the underlying data.
- Every chart has a text/table alternative.
- CSV opens correctly in a spreadsheet application.

---

## Phase 12 — Responsive Design & UI Polish
**Goal:** Consistent, polished experience on every screen size.

**Deliverables**
- Review all pages at 360, 576, 768, 1024, 1280px; fix issues.
- Mobile sidebar drawer, filter drawer, scrollable tables verified.
- Consistent spacing, empty states, loading states, hover/focus states, micro-transitions (respecting reduced motion).
- Print styles for resume.

**Acceptance criteria**
- No horizontal page scroll at any breakpoint.
- Lighthouse (Chrome DevTools) Accessibility score ≥ 90 on key pages.
- UI matches `UI_SPEC.md` tokens and components.

---

## Phase 13 — Testing
**Goal:** Verify the whole application and fix defects.

**Deliverables**
- `docs/TEST_CASES.md`: manual test cases per feature and role (ID, steps, expected, actual, pass/fail).
- Cross-browser check (Chrome, Edge, Firefox) and mobile emulation.
- Edge cases: empty storage, corrupted storage, quota exceeded, invalid URL params, direct URL access by wrong role.
- Bug fixes and a defect log in the same document.

**Acceptance criteria**
- All test cases executed and recorded; no open critical/high defects.
- No console errors on any page.

---

## Phase 14 — Documentation & Viva
**Goal:** Prepare final submission and viva material.

**Deliverables**
- Final `README.md` (features, screenshots, run guide, credentials, limitations).
- `docs/USER_GUIDE.md` (step-by-step per role).
- `docs/VIVA_NOTES.md` (architecture explanation, why frontend-only, storage design, likely questions and answers, limitations, future scope).
- `docs/screenshots/` of key pages.
- All documents reviewed for accuracy against the final code.

**Acceptance criteria**
- A new person can run and demo the project using only the README.
- Documentation matches the implemented behaviour.
- `PROJECT_STATUS.md` marks the project complete.
