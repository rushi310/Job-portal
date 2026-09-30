# PROJECT_STATUS.md — FreshHire Progress Tracker

> Frontend-only project (HTML5, CSS3, Vanilla JS ES6+, JSON mock data, localStorage, sessionStorage).
> Update this file at the end of every work session and every phase.

---

## Current Phase

| Field | Value |
|---|---|
| **Current phase** | **Phase 11 — Analytics & Reports** |
| Phase status | ✅ Complete — awaiting user approval to start Phase 12 |
| Last updated | 2026-09-30 |
| Current task | None |
| Next phase | **Phase 12 — Responsive Design & UI Polish** (not started; requires explicit user approval) |

## Phase Overview

| # | Phase | Status |
|---|---|---|
| 0 | Planning | ✅ Complete |
| 1 | Project Setup & Base UI | ✅ Complete |
| 2 | Login & Registration | ✅ Complete |
| 3 | Student Dashboard | ✅ Complete |
| 4 | Job Listing & Search | ✅ Complete |
| 5 | Job Details & Applications | ✅ Complete |
| 6 | Saved Jobs & Application Tracking | ✅ Complete |
| 7 | Student Profile & Resume | ✅ Complete |
| 8 | Recruiter Portal | ✅ Complete |
| 9 | Admin Portal | ✅ Complete |
| 10 | Notifications | ✅ Complete |
| 11 | Analytics & Reports | ✅ Complete |
| 12 | Responsive Design & UI Polish | ⏳ Not started |
| 13 | Testing | ⏳ Not started |
| 14 | Documentation & Viva | ⏳ Not started |

Legend: ⏳ Not started · 🔄 In progress · ✅ Complete

## Phase 0 Checklist (complete)

- [x] P0-T01 Planning documents created (8 files)
- [x] P0-T02 Cross-document consistency check
- [x] P0-T03 Confirmed no code, backend files, or dependencies

## Phase 1 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P1-T01 | Complete frontend folder structure (`pages/*`, `assets/*`, `data/`; `.gitkeep` in folders for later phases) | ✅ |
| P1-T02 | CSS design system: `variables.css`, `base.css`, `layout.css`, `components.css`, `utilities.css` | ✅ |
| P1-T03 | Core JS: `config.js`, `storage.js`, `utils.js`, `seed.js` | ✅ |
| P1-T04 | Seed data: `users.json` (11), `jobs.json` (20), `applications.json` (15), `notifications.json` (9) | ✅ |
| P1-T05 | Components: `icons.js`, `navbar.js` (public), `footer.js`, `toast.js`, `modal.js`, `job-card.js`, `empty-state.js` | ✅ |
| P1-T06 | `job-service.js` read-only getters (featured jobs, public stats, expiry) | ✅ |
| P1-T07 | `assets/images/logo.svg` | ✅ |
| P1-T08 | Landing page `index.html` + `landing.css` + `landing.js` | ✅ |
| P1-T09 | Validation (references, JSON, console, seeding, responsiveness) | ✅ |

### Phase 1 Acceptance Criteria

| Criterion | Result |
|---|---|
| Landing page loads via static server with no console errors | ✅ PASS (headless Edge, no page console messages) |
| First load seeds all `fh_` keys; `fh_data_version` = `DATA_VERSION` | ✅ PASS (6 keys; second load does not re-seed) |
| Only approved, non-expired jobs featured | ✅ PASS (6 newest; expired `job_003`, `job_013` excluded) |
| Toast and modal work on landing page | ✅ PASS (seed toast; "About this demo" modal with focus trap / Esc) |
| Usable at 360px and 1280px | ✅ PASS (no horizontal overflow at 360 / 768 / 1280) |

## Phase 2 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P2-T01 | Authentication foundation: `core/auth.js` (login, logout, getSession, getCurrentUser, isLoggedIn, hasRole) + `services/user-service.js` (find by email/id, demo password check, login eligibility, public user) | ✅ |
| P2-T02 | Login UI: `pages/auth/login.html`, `assets/css/pages/auth.css`, `assets/js/pages/auth/login.js` | ✅ |
| P2-T03 | Registration page (`pages/auth/register.html` + `register.js`), `register()` in auth.js, email uniqueness (BR-01), password rule (BR-02), recruiter created as `pending` | ✅ |
| P2-T04 | App navbar variant + `components/sidebar.js` | ✅ |
| P2-T05 | Minimal dashboard shells for student / recruiter / admin; page guards (`requireRole`, `redirectIfLoggedIn`); switch `getPostLoginPath()` to `ROLE_HOME_PATHS[role]` | ✅ |
| P2-T06 | Enable Login/Register links on the landing page, public navbar, and login page | ✅ |

### Phase 2 Acceptance Criteria (DEVELOPMENT_PHASES.md)

| Criterion | Result |
|---|---|
| Student and recruiter registration with full validation (BR-01, BR-02); recruiter created as `pending` | ✅ PASS |
| Login works for all three demo accounts; blocked users are refused (BR-03) | ✅ PASS |
| Session stored in `sessionStorage` `fh_session`; closing the tab logs out (BR-04) | ✅ PASS (sessionStorage verified; tab-close behaviour is the browser's sessionStorage lifetime — not simulated in the headless tests) |
| Role guard redirects correctly for no session and wrong role (BR-05) | ✅ PASS |
| Logged-in users visiting login/register are sent to their dashboard | ✅ PASS |
| Logout clears the session and returns to landing | ✅ PASS |

Task split note: the user defined P2-T02 as the login UI only, so registration moved to P2-T03 and the later tasks shifted by one.

### P2-T02 Validation (all passed)
- Validation: empty form, invalid email, empty password (inline errors, `aria-invalid`, focus first invalid, errors clear on correction).
- Auth integration via `core/auth.js` only: wrong password / unknown email → same alert; blocked account → blocked message; pending recruiter → logs in with a warning flash.
- Student, recruiter, admin logins navigated to the temporary destination `index.html` (user-approved until dashboards existed; replaced by role dashboards in P2-T05) with a one-time `fh_flash` toast.
- Loading state (disabled button, spinner, "Logging in…", `aria-busy`); duplicate submits → exactly one login.
- Password show/hide toggle (`aria-pressed`, label); demo "Use" buttons fill the form.
- Refresh keeps the session; the flash message is not repeated. (The login page's "You are logged in as…" notice was replaced in P2-T05 by a redirect to the dashboard, per ARCHITECTURE §5.)
- Keyboard: skip link first, labelled inputs and icon buttons, no positive tabindex. Responsive: no overflow at 360px; card 480px and centred at 1024px.
- 62/62 login UI checks, 56/56 auth checks, 42/42 Phase 1 regression checks; no console errors.

### P2-T03 Validation (all passed)
- Empty fields, invalid email/phone/CGPA/website, duplicate email (case/space-insensitive, also on blur), 4 weak-password patterns, password mismatch → field-level messages; first invalid field focused.
- Student registers as `active`, recruiter as `pending`, both with the documented user/profile structure; admin (or missing) role refused with `ROLE_NOT_ALLOWED`; status cannot be injected.
- Saved via `storage.js` to `fh_users`, survives reload; exactly one save despite repeated submits; loading state shown.
- No auto-login: redirects to the login page with the email pre-filled and a one-time toast (warning for recruiters explaining admin approval).
- New student logs in; new pending recruiter logs in with the approval warning.
- Password toggles on both password fields; labelled controls with linked errors; hidden role section disabled; no overflow at 360px.
- 57/57 registration checks, 62/62 login UI, 56/56 auth, 42/42 Phase 1; no console errors; passwords never logged.

### P2-T04 Validation (all passed)
- Student / recruiter / admin sidebars match UI_SPEC §3.3 exactly; nav labelled per role.
- Active item derived from the current path (`aria-current="page"` + distinct style); the page being viewed counts as available.
- Unbuilt pages are non-focusable, non-clickable "Soon" items (`aria-disabled`); no links to missing pages; no bell before Phase 10.
- User menu: name, email, role badge, "Awaiting approval" for pending recruiters, role profile item (Soon), Log out; opens/closes by click, Esc (focus returns), outside click, focus leaving.
- Logout via `auth.logout()` → `index.html` with a one-time toast; session cleared.
- Desktop (1280): fixed 240px sidebar, no ☰/close. Tablet (768) and mobile (360): off-canvas drawer, hidden from keyboard when closed, focus moves in on open, Tab/Shift+Tab wrap, Esc/backdrop/close button/link close it, focus returns to ☰; growing to desktop closes it. No horizontal overflow at any width.
- Tested on a scratch harness page (no placeholder pages created). 79/79 navigation checks; regressions 62/62 login, 57/57 registration, 56/56 auth, 42/42 Phase 1; no console errors.
- Headless note: the browser's own resize event is not dispatched under virtual time, so the test dispatches it after resizing; CSS transitions were disabled in the test frame for the same reason.

### P2-T01 Validation (all passed)
- Student / recruiter / admin demo logins succeed with the correct role; session holds only `userId`, `role`, `name`, `loginAt` in sessionStorage; no password returned.
- Wrong password and unknown email both return `INVALID_CREDENTIALS` with the same message; empty fields return `MISSING_FIELDS`; no session is created on failure.
- Blocked recruiter refused (`ACCOUNT_BLOCKED`); pending recruiter logs in with `isPendingApproval: true` (per PROJECT_SPEC §2 / BR-03 / BR-07, confirmed by user).
- `getCurrentUser` / `isLoggedIn` / `hasRole` / `logout` behave correctly; sessions end automatically if the user is blocked, deleted, or the stored role is tampered with.
- 56/56 auth checks, 42/42 Phase 1 regression checks, landing page renders; no page console errors.

### P2-T05 Validation (all passed)
- Files: `pages/{student,recruiter,admin}/dashboard.html`, `assets/js/pages/{student,recruiter,admin}/dashboard.js`, `assets/js/components/app-shell.js`; `requireRole`, `redirectIfLoggedIn`, role-based `getPostLoginPath(role, returnTo)` in auth.js; Dashboard nav items available; login page notice replaced by redirect; register + landing redirect logged-in users.
- Each role reaches its own dashboard (title, single h1, "Welcome back, <name>", navbar + sidebar + footer, Dashboard active); pending recruiter sees the approval badge.
- Anonymous → login with `?returnTo=` and "Please log in" toast; logging in returns to the requested page. Wrong role → own dashboard with warning toast; URL settles (no loop). Blocked-after-login user → login.
- `returnTo` safety: external URLs, protocol-relative, absolute, `javascript:`, path traversal, and other-role pages are ignored.
- Logged-in users visiting landing / login / register → own dashboard. Logout from a dashboard → landing, session cleared; dashboard then requires login again.
- Shell hidden until the guard passes; no horizontal overflow at 360 / 768 / 1024 / 1280 (drawer below 1024, fixed sidebar at 1024+).
- 51/51 guard/dashboard checks.

### P2-T06 Validation (all passed)
- Files: `navbar.js` (Log in / Register links from `PAGE_PATHS`; `createSoonButton` removed as unused), `index.html` (hero + recruiter CTA links), `login.html` ("Create an account" link), `register.js` (`?role=recruiter` pre-selects the role; `?role=admin` ignored).
- Landing → Login, Landing → Register (navbar, hero, recruiter CTA), Login ↔ Register, Login/Register → Home all verified by clicking; `?email=` still pre-fills; mobile menu shows both links; no broken static links or assets on the 6 pages.
- 16/16 link checks.

### Phase 2 Final Regression (all run on the final code)
- Browser suites (headless Edge 1700px window, fresh profiles): Phase 1 42/42, auth logic 56/56, login UI 59/59, registration 57/57, navigation 79/79, guards/dashboards 51/51, links 16/16 — **360/360 passed**, no page console errors.
- Static: all JS imports resolve; all HTML href/src resolve; every page has `lang`, viewport, one h1, one script; all CSS custom properties defined, braces balanced; no direct storage calls outside storage.js; no `console.log`/`var`/inline styles/handlers; `git diff --check` clean; no backend files or dependencies.

### Known Limitations
- Tested in headless Microsoft Edge only (Chrome/Firefox cross-browser checks are scheduled for Phase 13).
- Headless virtual time does not run CSS transitions or deliver resize events, so tests disable transitions and dispatch `resize` manually; real-browser resizing should be spot-checked.
- Closing the tab to end the session relies on the browser's sessionStorage lifetime; not automated.
- Frontend-only simulation: plain-text demo passwords, data per browser (by design, PROJECT_SPEC §8).

### Deferred to Later Phases
- Dashboard content (stats, recent applications, recommended jobs) → Phase 3; recruiter/admin dashboards → Phases 8 / 9.
- Pending-recruiter approval banner → Phase 8. Notification bell → Phase 10.
- All sidebar items other than Dashboard remain "Soon" until their pages are built.

## Phase 3 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P3-T01 | Read-only services: `application-service.js`, `saved-job-service.js`, `notification-service.js`; `getRecommendedJobs` + malformed-record hardening in `job-service.js`; `getProfileCompleteness` in `user-service.js` | ✅ |
| P3-T02 | Student dashboard page (`pages/student/dashboard.html`, `assets/js/pages/student/dashboard.js`, `assets/css/pages/student.css`) | ✅ |
| P3-T03 | Validation, regression, documentation | ✅ |

### Phase 3 Acceptance Criteria (DEVELOPMENT_PHASES.md)

| Criterion | Result |
|---|---|
| Numbers match the logged-in student's data in localStorage | ✅ PASS (compared with values computed independently from raw storage for 2 seed students + 1 new student) |
| Empty states shown for a newly registered student | ✅ PASS (applications, updates; recommended falls back to latest jobs with a hint) |
| Links to pages not yet built are disabled ("Soon") | ✅ PASS (quick actions, "Complete your profile", both "View all") |

### Phase 3 Implementation
- **Created:** `assets/js/services/application-service.js`, `saved-job-service.js`, `notification-service.js`, `assets/css/pages/student.css`.
- **Modified:** `pages/student/dashboard.html` + `assets/js/pages/student/dashboard.js` (shell → full dashboard), `job-service.js` (`getRecommendedJobs`; skips records without id/title/company; missing/invalid deadline = expired), `user-service.js` (`getProfileCompleteness`), `job-card.js` (optional `note`; tolerates missing skills/location/experience), `components.css` (`.job-card__note`); docs: PROJECT_SPEC §3.2, UI_SPEC §5, ARCHITECTURE §7, README.
- **Decisions:** stats follow DEVELOPMENT_PHASES/UI_SPEC (Applications, Shortlisted, Saved jobs, Profile complete — no "Available jobs" card); recommended jobs by skill match (UI_SPEC) rather than plain "latest jobs"; no separate dashboard service (the page composes the planned services); quick actions and "View all" read availability from the sidebar's `NAV_ITEMS`, so they turn into links automatically when pages are built; each section renders independently, so one failing section shows a message instead of breaking the page; the student's id always comes from the session, never the URL.
- **Validation:** 45/45 new dashboard checks (stats vs raw storage, ranking, ownership for two students, URL id ignored, empty states, XSS via job/notification/user name, malformed data, recruiter/admin/anonymous blocked, 360/375/768/1024/1280 layouts, logout, console). Regression on final code: Phase 1 42/42, auth 56/56, login 59/59, registration 57/57, navigation 79/79, guards 51/51 (student greeting check updated for the new dashboard), links 16/16 — **405/405 total**. Static: imports, links, CSS tokens/braces, JSON, storage access rule, `git diff --check` — all clean. Screenshots checked at 1280 / 1024 / 360.

### Phase 3 Known Limitations
- Headless Edge only (cross-browser in Phase 13).
- "Saved jobs" is always 0 until saving exists (Phase 6); seed data has no saved jobs.
- Notification items are text only (their links point to pages built in later phases).

### Deferred
- Job search/filters (Phase 4), job details & apply (Phase 5), saved jobs & application tracking pages (Phase 6), profile & resume editing (Phase 7), notification centre / mark-as-read (Phase 10), charts (Phase 11).

## Phase 4 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P4-T01 | `job-service.js`: `searchJobs(criteria)` (search title/company/skills; location, job type, work mode, pay range, skills filters; sort newest/deadline/salary) + `getJobFilterOptions()`; `paginate()` in utils.js; `components/pagination.js`; config: `JOB_SORT_OPTIONS`, `PAY_RANGES`, `SEARCH_DEBOUNCE_MS` | ✅ |
| P4-T02 | Browse Jobs page (`pages/student/jobs.html`, `assets/js/pages/student/jobs.js`, styles in `student.css`), filter drawer below 1024px, `fh_job_filters` persistence, sidebar "Browse Jobs" available | ✅ |
| P4-T03 | Validation + regression on the final code | ✅ (re-run 2026-09-30: 479/479, static checks and `git diff --check` clean) |

### Phase 4 Validation
- New suite `jobs-test`: **74/74 passed** — listing & counts vs an independent reference implementation, pagination, search (title/company/skill, case/whitespace, multi-word, special characters, debounce = 1 update for 5 keystrokes, Enter), each filter, combined filters, all sorts, no mutation of stored jobs, clear filters (panel + empty state), expired hidden / "Show expired" with labels, persistence + tampered-state sanitising, malformed records, recruiter/admin/anonymous blocked, dashboard quick action now links, 360/375/768/1024/1280 layouts, drawer focus trap / Esc / backdrop / "Show results", labels and live region.
- Full regression before the last CSS fixes: Phase 1 42, auth 56, login 59, registration 57, navigation 79, guards 51, links 16, student dashboard 45, jobs 74 — **479/479 passed**, no console errors. (Navigation and dashboard assertions were made data-driven from `NAV_ITEMS` because "Browse Jobs" is now available.)
- After that run, three CSS-only alignment fixes were made in `student.css` (toolbar `align-items: start`, drawer body `align-content: start`, Filters button top margin at ≥768px), verified by screenshots. The re-run was blocked by a tooling issue on 2026-09-29 and completed on 2026-09-30 on the final code: **479/479 passed**, static checks clean, `git diff --check` clean. **Phase 4 complete.**

## Phase 5 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P5-T01 | Services: `getVisibleJob` (job-service); `getApplicationForJob`, `checkEligibility` (BR-14), `getApplyStatus`, `validateApplicationForm`, `applyToJob` (application-service); config `PAGE_PATHS.JOBS/JOB_DETAILS`, `COVER_NOTE_MAX_LENGTH` | ✅ |
| P5-T02 | Job Details page (`pages/student/job-details.html`, `assets/js/pages/student/job-details.js`, styles in `student.css`) with apply modal; "View details" links on Browse Jobs + dashboard cards (`createViewDetailsLink` in job-card.js) | ✅ |
| P5-T03 | Validation, regression, documentation | ✅ |

### Phase 5 Acceptance Criteria (DEVELOPMENT_PHASES.md)

| Criterion | Result |
|---|---|
| Invalid/missing `id` or non-approved job shows "Job not found" | ✅ PASS (no id, empty id, unknown id, pending, rejected, closed, malformed, script-like id) |
| Eligibility box ✓/✗ per rule; Apply disabled when ineligible, expired, or already applied (BR-12–BR-14) | ✅ PASS (UI and service both enforce) |
| Application stored in `fh_applications` with `statusHistory` (BR-16) and resume reference if present (BR-17) | ✅ PASS (schema compared key-by-key) |

### Phase 5 Decisions
- **Scope change (user decision):** application withdrawal moved from Phase 5 to Phase 6; DEVELOPMENT_PHASES and PROJECT_SPEC §3.2 updated.
- Form fields follow PROJECT_SPEC §5.3: optional cover note only (≤ 1,000 characters — no limit was documented); the resume file name is attached automatically when the profile has one; no resume upload (Phase 7).
- `applyToJob(jobId, form)` reads the student from the session (`getCurrentUser`), re-checks role, job visibility, expiry, duplicate (BR-13, also re-read right before writing), eligibility and the form, then writes once via `storage.js`; storage failures return an error without a partial record.
- A student may open any approved job (expired included, shown as Expired); other statuses are "Job not found" (BR-08).
- No artificial delay on submit; the button is disabled with "Submitting…" and a guard flag blocks repeated clicks.
- On small screens the apply panel sits directly under the job header; from 1024px it is a sticky right column.

### Phase 5 Validation
- New suite `details-test`: **62/62** — job data shown correctly; 8 invalid/hidden job cases; XSS through every job field; modal accessibility (dialog, focus, labels, error association, Esc returns focus); cover-note validation (too long rejected, value kept, focus, error clears); storage failure (message, modal and text kept, retry works, no record, no success); successful submission with double click → exactly one record; record schema, ids, recruiter, status, history, timestamps, trimmed note; persistence after reload; seed application detected; dashboard count updates; expired and ineligible blocked in UI and service; two-student ownership; resume reference only (no file data); service refuses unknown/pending/rejected/closed jobs, non-string note, logged-out and recruiter sessions; View details links from Browse Jobs and dashboard; recruiter/admin blocked; logged-out → login → back to the same job; 360/375/768/1024/1280 layouts and modal fit; no console errors (apart from the intentional storage-failure log).
- Regression on the final code: Phase 1 42, auth 56, login 59, registration 57, navigation 79, guards 51, links 16, student dashboard 45, jobs 74, details 62 — **541/541 passed**. Two older checks ("cards have no links") updated to expect the new "View details" link.
- Static: imports, HTML links, CSS tokens/braces, JSON, storage-access rule — clean; `git diff --check` clean.

### Phase 5 Known Limitations
- Headless Edge only (cross-browser in Phase 13).
- A student cannot open a job after it is closed (BR-10 keeps it visible "in existing applications", which is the My Applications page in Phase 6).
- Notifications for new applications are created in Phase 10.

## Phase 6 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P6-T01 | Services: `saveJob` / `unsaveJob` / `isJobSaved` / `getSavedJobsWithDetails` (saved-job-service), `canWithdraw` / `withdrawApplication` (application-service), `getJobAvailability` (job-service); config `PAGE_PATHS.SAVED_JOBS/APPLICATIONS` | ✅ |
| P6-T02 | `components/save-button.js`; Save toggle on Browse Jobs cards and Job Details; "Track in My Applications" link | ✅ |
| P6-T03 | Saved Jobs page (`pages/student/saved-jobs.html` + `saved-jobs.js`) | ✅ |
| P6-T04 | My Applications page (`pages/student/applications.html` + `applications.js`): status filter, timeline, withdraw | ✅ |
| P6-T05 | Sidebar items available; validation, regression, documentation | ✅ |

### Phase 6 Acceptance Criteria (DEVELOPMENT_PHASES.md)

| Criterion | Result |
|---|---|
| Save/unsave toggles consistently across jobs list, details, and saved page (BR-18) | ✅ PASS |
| Applications page shows every application with correct status badge and timeline | ✅ PASS |
| Withdraw works and updates the timeline; only from `applied` / `under_review` (BR-15); `application-service` provides withdraw | ✅ PASS (with confirmation dialog; service-level checks) |

### Phase 6 Decisions
- Withdraw implemented because DEVELOPMENT_PHASES lists it under Phase 6 (moved there in Phase 5 by user decision).
- No application sort control (none specified); default order = most recent activity. Status filter = All + the 7 defined statuses with counts.
- Saved jobs store only `{ studentId, jobId, savedAt }`; stale links are never auto-deleted and can be removed by the student.
- Save/unsave/withdraw take the student from the session; the save toggle is shared (`components/save-button.js`, documented layer-rule exception).
- Dashboard: no layout change — Saved jobs / Applications stats already read live data; quick actions and "View all" became links via `NAV_ITEMS`.

### Phase 6 Validation
- New suite `tracking-test`: **69/69** — save/unsave on Browse Jobs (record shape, toast, no navigation), idempotent save, persistence after reload, search still works, Job Details save + apply still works, Saved Jobs page order/count/cards, dashboard saved count, unsave on Saved page (focus management), pending job cannot be saved / expired can, missing & closed & expired saved jobs, corrupted records ignored, stale removal; two-student ownership for saved jobs; service refuses logged-out and recruiter; My Applications order, card content, filter counts and filtering, empty filter + Show all, timeline + notes + cover note, Withdraw only where allowed, no status controls, expired/closed/missing jobs kept as history, confirm → cancel → withdraw, history appended, UI updated, service refuses non-withdrawable / other student's application, withdrawn blocks re-applying, two-student ownership, URL id ignored, XSS via cover note/history note, empty state, dashboard links, recruiter/admin/anonymous blocked on both pages, 360/375/768/1024/1280 on both pages, no console errors.
- Regression on the final code: Phase 1 42, auth 56, login 59, registration 57, navigation 79, guards 51, links 16, student dashboard 45, jobs 74, details 62, tracking 69 — **610/610 passed**. Four older checks updated for intended changes (dashboard quick actions / "View all" now links; Job Details Save is a real toggle).
- Static: imports, HTML links, CSS tokens/braces, JSON, storage-access rule — clean; `git diff --check` clean. Screenshots checked (My Applications 1280, Saved Jobs 360).

### Phase 6 Known Limitations
- Headless Edge only (cross-browser in Phase 13).
- Recruiter-side status changes (which fill the timeline further) arrive in Phase 8; notifications in Phase 10.

## Phase 7 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P7-T01 | `services/profile-service.js` (per-tab validation + save, resume upload/replace/remove/view, student from session); `user-service.updateStudentRecord` (only `name`, `phone`, `profile` writable); config `PROFILE_LIMITS`, `PROFILE_LINK_FIELDS`, `RESUME_MIME_TYPE`, `PAGE_PATHS.PROFILE` | ✅ |
| P7-T02 | `components/tabs.js` (accessible tabs, URL hash) and `components/resume-sheet.js` (generated resume) | ✅ |
| P7-T03 | Profile & Resume page (`pages/student/profile.html` + `profile.js`): summary, completeness, tabs Personal / Education / Skills / Projects & Links / Resume | ✅ |
| P7-T04 | Resume: PDF ≤ 500 KB as Base64, view / download / replace / remove; printable A4 resume (`@media print`, `window.print()`) | ✅ |
| P7-T05 | Integration: sidebar + user-menu Profile link available, navbar name refresh, Job Details "Upload one on your profile" link; validation, regression, documentation | ✅ |

### Phase 7 Acceptance Criteria (DEVELOPMENT_PHASES.md)

| Criterion | Result |
|---|---|
| All profile edits persist and update profile completeness on the dashboard | ✅ PASS (reload + dashboard checks) |
| Non-PDF or oversize files are rejected with a clear message; quota errors handled | ✅ PASS (text/docx/png, 500 KB + 1 byte, empty file; simulated `QuotaExceededError` keeps the old resume) |
| Generated resume prints cleanly on A4 | ✅ PASS (headless print-to-PDF: one A4 page, 595 × 842 pt, only the resume printed) |

### Phase 7 Decisions
- Fields are exactly PROJECT_SPEC §5.1 (no new schema fields). Email is read-only (login ID); password, role, status, id and createdAt are never editable here — enforced by a whitelist in `user-service.updateStudentRecord`.
- Each tab has its own "Save changes" and saves only its section, so unsaved edits in other tabs are not lost or saved by accident.
- Registration's rules are reused for name, phone, college, degree, branch, graduation year and CGPA. Limits that were not documented (text lengths, 5 entries, 30 skills, education year range) were chosen for localStorage size and recorded in PROJECT_SPEC §3.2 "Profile rules".
- URLs must be http(s); profile links are displayed as plain text only (no clickable links from profile data).
- `profile-service.js` is a new service because the student must come from `auth.getCurrentUser()`, and `user-service` cannot import `auth` (auth already imports user-service).
- Resume size/type shown on the page are computed from the stored data URL (no extra stored fields). View/Download use a temporary `blob:` URL of the logged-in student's own file.
- Printing the Profile page prints only the generated resume (print styles scoped to `.profile-page`).
- No simulated delay on profile saves (the prompt asked not to simulate latency); saving is synchronous, so double submits cannot happen; resume upload disables its button while the file is read.

### Phase 7 Validation
- New suite `profile-test`: **127/127** — access control (logged out → login with returnTo, recruiter → own dashboard); page load, URL user ids ignored, tabs (keyboard arrows/Home/End, hash deep link, missing-item shortcuts); personal validation (required, 10-digit phone, length limits, blur + submit, first invalid focused, values preserved) and save (trimmed, protected fields unchanged, navbar/summary refresh, toast, no reload); service whitelist against tampered `role`/`status`/`email`/`id`/`password`/`resume`; persistence after reload; education (selects, CGPA, entry add/remove/renumber, required + year range, max 5); skills (Enter/Add, duplicates ignoring case, empty, length, max 30, remove with focus management, empty list, completeness); projects & links (javascript:/ftp:/no-protocol rejected, saved, completeness); resume (no file, non-PDF, .docx, 500 KB + 1 rejected, empty rejected, exact 500 KB accepted, metadata, completeness 100%, view/download blob URLs, identical bytes, invalid replacement keeps old, quota failure keeps old + retry, remove with confirm/cancel, corrupted data URL and bad Base64 handled); application integration (resume file name recorded, history untouched by removal, Job Details link + attached resume, apply via UI); dashboard completeness; two-student ownership (Priya vs Asha: profile, resume, saved jobs, applications, notifications); logged-out and recruiter refused by the services; XSS in name/location/about/skills rendered as text; printable resume content + print copy + `window.print()`; labels, error associations, required markers, tab ARIA, progress bar, heading levels; 360/375/768/1024/1280 with every tab; no console errors (the two intentional quota-simulation logs are expected).
- Regression on the final code: Phase 1 42, auth 56, login 59, registration 57, navigation 79, guards 51, links 16, student dashboard 45, jobs 74, details 62, tracking 69 — **610/610 passed**. Three older checks updated for the intended change "Profile & Resume is now available" (navbar user-menu item, dashboard quick actions ×2).
- Static: imports/exports (36 modules), HTML references (11 pages), CSS tokens/braces, JSON, storage-access rule, no `console.log`/`var`/`innerHTML` — clean; `git diff --check` clean. Screenshots checked (1280 Personal, 768 Education, 375 Resume, 360 Skills/Projects/Resume); A4 print verified as PDF.

### Phase 7 Known Limitations
- Headless Edge only (cross-browser in Phase 13). Print verified via Edge print-to-PDF, not on paper.
- Resumes live in this browser's localStorage (≤ 500 KB each), so several large resumes can fill the ~5 MB quota; the page then shows "Browser storage is full" and keeps the previous data.
- The session's stored `name` is not refreshed after a name change (nothing reads it; the navbar uses the user record).
- A graduation year outside the registration range (current year −2 … +2) must be re-selected before the Education tab can be saved (same rule as registration).
- Recruiters viewing a student's profile/resume arrives in Phase 8.

## Phase 8 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P8-T01 | `job-service`: own-job queries, job validation, `createJob` / `updateJob` / `closeJob` (BR-07 – BR-11, recruiter from the session, `active` only); config `JOB_LIMITS`, `COMPANY_SIZE_OPTIONS`, `RECRUITER_STATUS_FLOW`, recruiter `PAGE_PATHS` | ✅ |
| P8-T02 | `application-service`: recruiter applicant queries, applicant details (no password), applicant resume, `updateApplicationStatus` (BR-15, BR-16; ownership via `job.recruiterId`) | ✅ |
| P8-T03 | `profile-service.updateCompanyProfile` + `user-service.updateRecruiterRecord` (whitelist); shared `decodeResumeFile` | ✅ |
| P8-T04 | Pages: Dashboard (full), Post / Edit Job, My Jobs, Applicants, Company Profile + `recruiter.css`; `components/approval-banner.js`; recruiter sidebar + account-menu items available | ✅ |
| P8-T05 | Validation, two-recruiter isolation, student regression, documentation | ✅ |

### Phase 8 Acceptance Criteria (DEVELOPMENT_PHASES.md)

| Criterion | Result |
|---|---|
| `pending` recruiters see the approval banner and cannot post jobs (BR-07) | ✅ PASS (banner on every recruiter page that manages jobs; no form; service refuses) |
| New jobs saved as `pending`; editing core fields of an approved job returns it to `pending` | ✅ PASS (title and salary edits tested; non-core edit keeps `approved`) |
| Recruiters see only their own jobs and applicants | ✅ PASS (two recruiters, both directions; URL ids and a forged `application.recruiterId` ignored) |
| Status changes follow the allowed flow and are recorded in history | ✅ PASS (next step or rejected only; finals confirmed; history appended, never rewritten) |
| Student profile and resume viewable from the applicants page | ✅ PASS (View profile dialog; resume view/download for own applicants only) |

### Phase 8 Decisions
- Pending recruiters keep the earlier decision (they can log in). They see the banner, can edit their company profile, and cannot post, edit or close jobs or open applicants — enforced in the services, not only the UI.
- Dashboard stats are exactly PROJECT_SPEC §3.3 (active jobs, total applicants, shortlisted, pending approval); definitions recorded in §3.3 "Recruiter rules".
- Editing is allowed for `pending` and `approved` jobs only; `rejected` and `closed` are final for the recruiter (no resubmission or reopening is specified). No recruiter delete (not in the spec; admin deletes jobs in Phase 9).
- BR-11 core fields = title, description, eligibility, salaryMin / salaryMax / salaryPeriod. Other fields (location, type, mode, experience, openings, deadline, skills, responsibilities) keep an approved job approved.
- Company name is copied from the recruiter's profile at creation and is not changed by later job edits or company renames.
- Recruiter status changes: one step forward or rejected (BR-15 diagram); history note is empty (no note field is specified). Selected / rejected ask for confirmation.
- Ownership of an application is `application.jobId` → `job.recruiterId`; the copied `application.recruiterId` is ignored.
- The recruiter's candidate view reuses `components/resume-sheet.js`; the resume file is decoded only after the ownership check (`getApplicantResumeFile`). The resume shown is the student's current one; the name sent with the application is shown too.
- Job limits not in the docs (lengths, 15 skills, 10 responsibilities, 1–1,000 openings) were chosen for storage size and recorded in PROJECT_SPEC §3.3. Internships must use a monthly stipend (PROJECT_SPEC §5.2).
- Shared dashboard CSS (stat grid, lists, quick actions, status-filter tabs, `.avatar--lg`) moved unchanged from `student.css` to `components.css` instead of duplicating it; student screenshots and all student suites confirm no change.
- No simulated delay on recruiter saves.

### Phase 8 Validation
- New suite `recruiter-test`: **119/119** — access (logged out → login with returnTo on all 5 pages; student and admin → own dashboards; blocked cannot log in); pending recruiter (banner, zero stats, no post form, service refusals for create/status/details, nothing changed, company profile editable); dashboard (spec labels, stats computed from storage for two recruiters, recent applicants own-only with links, quick actions, sidebar); company profile (prefill, safe website link, required/phone/`javascript:` validation with first-invalid focus, save + toast, protected fields and tampered role/status/email/id ignored, HTML rendered as text); My Jobs (own jobs only, filter counts, applicant counts, action rules, Expired / pending notes, filters incl. empty state, close with cancel/confirm, applications kept, closed job hidden from students, closing pending/closed refused); Post Job (required errors with focus, skill chips Enter/duplicate, openings/deadline/internship-monthly/max ≥ min rules, preview dialog as text, back to editing, submit → My Jobs + flash, stored shape = schema, pending + owner/company from session, invisible to students, injected owner/status/id/company ignored, service validation); Edit (prefill incl. skills/checkboxes, live-job note, non-core edit stays approved, core edit and salary edit → pending, recruiter cannot approve, closed job not editable); two-recruiter isolation both ways (edit/close/view/update refused, URL recruiter id ignored, data unchanged, forged `application.recruiterId`); applicants (only this job, names, allowed next statuses, empty choice hint, update + history appended + focus, final confirm cancel/confirm, finals and withdrawn locked, invalid transitions refused); candidate dialog (contact, cover note, timeline, profile, no password/Base64, resume view/download blob URLs and bytes); student sees recruiter status change in My Applications; student applies to a recruiter-created job (approval set by fixture — Phase 9) → recruiter sees and moves it → student withdraws → recruiter cannot change it; labels, error associations, fieldsets, table caption/scopes, labelled selects, heading levels; 360/375/768/1024/1280 on all recruiter pages + dialog at 360; no console errors.
- Regression on the final code: Phase 1 42, auth 56, login 59, registration 57, navigation 79, guards 51, links 16, student dashboard 45, jobs 74, details 62, tracking 69, profile 127 — **737/737 passed**. Checks updated: recruiter account-menu "Company Profile" is now a link (intended); student-dashboard "not rendered" marker changed from `[data-stats]` (recruiter dashboard now has stats) to `[data-recommended]`; the seed student's name was changed in `data/users.json` by the user (Asha Patil → Rishita Kadam), so 6 checks that read the seed name were updated.
- Static: imports/exports (41 modules), HTML references (15 pages), CSS tokens/braces, JSON, storage-access rule, no `console.log`/`var`/`innerHTML` — clean; `git diff --check` clean. Screenshots checked: recruiter dashboard, My Jobs, Edit Job, Applicants + profile dialog (1280), My Jobs, Applicants, Company Profile, Post a Job (360), student dashboard (1280).

### Phase 8 Known Limitations
- Headless Edge only (cross-browser in Phase 13).
- Admin approval / rejection of jobs and recruiters arrives in Phase 9 (tests set `approved` directly as a fixture). Notifications for status changes arrive in Phase 10.
- `data/users.json` was edited (seed student renamed) without bumping `DATA_VERSION`, so browsers that already hold seed data keep the old name until site data is cleared.
- The recruiter sees the student's current resume; if the student replaced it after applying, the file sent at the time is not kept (only its name, BR-17).

## Phase 9 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P9-T01 | `services/admin-service.js`: platform totals, users (list/search/filter, approve recruiter, block, unblock, delete with cleanup), jobs (list, approve, reject with reason, delete), reset demo data; `seed.ensureSeeded({ force })`; config `PAGE_PATHS.ADMIN_USERS/ADMIN_JOBS`, `REJECTION_REASON_MAX_LENGTH` | ✅ |
| P9-T02 | Admin Dashboard (full): totals, jobs by status, pending recruiters / jobs quick lists, danger zone | ✅ |
| P9-T03 | Users page (`pages/admin/users.html` + `users.js`) and Moderate Jobs page (`pages/admin/jobs.html` + `jobs.js`); `assets/css/pages/admin.css`; admin sidebar Users + Jobs available | ✅ |
| P9-T04 | Validation, security/ownership tests, regression, documentation | ✅ |

### Phase 9 Acceptance Criteria (DEVELOPMENT_PHASES.md)

| Criterion | Result |
|---|---|
| Admin cannot block or delete their own account | ✅ PASS (no actions on admin rows; service refuses) |
| Approved recruiters can immediately post jobs; blocked users are logged out on their next page load | ✅ PASS (approved recruiter's `createJob` succeeds; blocked user's open session ends on the next page and login is refused) |
| Approved jobs appear in student search; rejected jobs show the reason to the recruiter | ✅ PASS (`searchJobs` / `getVisibleJob`; reason on My Jobs) |
| Every destructive action requires confirmation | ✅ PASS (Block, Delete user, Delete job, Reject (reason dialog), Reset demo data; cancel tested) |

### Phase 9 Decisions
- Admin logic is in a new `admin-service.js` (documented in DEVELOPMENT_PHASES): it needs the admin from the session and cross-collection deletes. It re-checks the admin role on every call.
- Status actions use only the existing values: pending recruiter → Approve (`active`); `active` → Block; `blocked` → Unblock (`active`). No recruiter "reject" (not in the spec) — a pending recruiter can be deleted. Pending recruiters are not blocked (Delete instead), so Unblock can never skip approval.
- Admin accounts (including the admin's own) have no actions; admins are seed-only (BR-06).
- User delete cleanup (per DEVELOPMENT_PHASES): student → applications, saved jobs, notifications; recruiter → jobs, every application and saved link for them, notifications. Notifications of the deleted user are removed because they can never be read again (no new notification behaviour).
- Job delete removes only the job: applications and saved links stay as history (PROJECT_SPEC §3.2), shown as "Job no longer available".
- Approve / reject only from `pending` (BR-09). Rejection reason 1–300 characters. Approving never changes owner, company or content.
- No admin application management (not in PROJECT_SPEC §3.4); applications appear only as totals and applicant counts.
- Dashboard shows the §3.4 totals (students, recruiters, jobs by status, applications); it and the lists re-render on the `storage` event, so changes from other tabs appear without reloading.
- "View" job details dialog added on Moderate Jobs so the admin can read a job before approving (UI_SPEC lists the table actions only).
- Reset demo data fetches the seed files before clearing anything (a failed fetch leaves data untouched); the admin session stays valid.
- Shared management-table CSS (stacked rows on phones, row actions, detail lists, list count, wrapping status filter) moved unchanged from `recruiter.css` to `components.css` for reuse by admin pages. Side effect: the student My Applications status filter now wraps on phones instead of scrolling sideways.

### Phase 9 Validation
- New suite `admin-test`: **85/85** — logged-out / student / recruiter / pending recruiter redirected from every admin page, no admin links in their sidebars, every admin service refused for them and nothing changed; recruiter still cannot approve own job; dashboard totals and jobs-by-status from storage, filter links, pending quick lists, live update on storage change; users table (all accounts, no passwords, admin row without actions, actions per status, "Pending approval" label, role / status / combined filters, debounced search, empty state, URL presets); approve (persisted, no duplicate, account data kept, recruiter posts immediately); block (confirm cancel / confirm, login refused, open session ended on next page), unblock (can log in); self / invalid transitions refused; delete student and recruiter with cleanup and other data untouched, deleted user cannot log in; jobs (preset filter, counts, action rules, View dialog, approve keeps owner/content, visible to students, persisted, approve/reject only pending, reject reason dialog validation, reason stored trimmed and shown as text, recruiter sees reason, rejected job hidden, recruiter isolation intact, delete with confirmation keeps application history, student ownership intact); reset (cancel, confirm → seed restored, saved jobs empty, admin still logged in, toast); labels, table captions / scopes, action names, filter `aria-pressed`, heading levels; 360 / 375 / 768 / 1024 / 1280 on all admin pages + reject dialog at 360; no console errors.
- Regression on the final code, no test changes needed: Phase 1 42, auth 56, login 59, registration 57, navigation 79, guards 51, links 16, student dashboard 45, jobs 74, details 62, tracking 69, profile 127, recruiter 119 — **856/856 passed**.
- Static: imports/exports (44 modules), HTML references (17 pages), CSS tokens / braces / no hex colours, JSON, storage-access rule, no `console.log` / `var` / `innerHTML` — clean; `git diff --check` clean. No build step exists (static project). Screenshots checked: admin dashboard 1280, users 1280 + 360, jobs 1280 with reject dialog + 360.

### Phase 9 Known Limitations
- Headless Edge only (cross-browser in Phase 13).
- No notifications are sent for approvals, blocks or rejections (Phase 10). Admin reports / charts are Phase 11.
- Sidebar labels next to a "Soon" tag can be cut off at 1280px (e.g. "Announcements"); existing sidebar styling, left for Phase 12 polish.
- A delete writes several collections one after another; a storage failure part-way could leave related records, although deletes only shrink data.

## Phase 10 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P10-T01 | `notification-service.js`: own list, unread count, `markAsRead` / `markAllAsRead` (session-owned), safe links, `createNotification(s)`; config `NOTIFICATION_TYPES`, `ANNOUNCEMENT_AUDIENCES`, `ANNOUNCEMENT_LIMITS`, `PAGE_PATHS.NOTIFICATIONS/ANNOUNCEMENTS` | ✅ |
| P10-T02 | Events (§4.5): apply → recruiter; recruiter status change → student; job approved / rejected → recruiter; recruiter approved → recruiter; announcement → audience | ✅ |
| P10-T03 | Navbar bell with unread count (app-shell → navbar), `setNotificationBadge`; Notifications sidebar item for all roles | ✅ |
| P10-T04 | `pages/shared/notifications.html` + script; `pages/admin/announcements.html` + script (`admin-service.sendAnnouncement`, `getSentAnnouncements`) | ✅ |
| P10-T05 | Validation, ownership tests, regression, documentation | ✅ |

### Phase 10 Acceptance Criteria (DEVELOPMENT_PHASES.md)

| Criterion | Result |
|---|---|
| Each event in §4.5 creates a notification for the correct recipient(s) | ✅ PASS (all 5 events; refused actions and repeats create nothing) |
| Unread count updates after marking read; "Mark all as read" works | ✅ PASS (bell + count line update without reload; persisted) |
| Clicking a notification marks it read and navigates to its link | ✅ PASS (link only if it is a page of the user's role or shared; the page's own guards still apply) |

### Phase 10 Decisions
- Existing schema (§5.5) only; no new fields or storage keys. Type labels live in `notification-service` (`NOTIFICATION_TYPE_LABELS`).
- Only the five §4.5 events create notifications. Not added (not in §4.5): student withdrawal (the student's own action), notifications for admins (e.g. pending approvals — the admin dashboard already lists them), job closed, account blocked.
- Notifications are created after the state change is saved; a failed notification write never undoes the action.
- Links are shown only for project pages in the user's own role folder or `pages/shared/` (same rule as login `returnTo`); otherwise the title is plain text. Destination pages keep their ownership checks (e.g. another recruiter's job → "Job not found").
- Grouping: "Today", "Yesterday", then the date; unreadable dates go under "Earlier". Unread = text "Unread" badge + style.
- Announcements: title (≤ 100) and message (≤ 500) required; confirmation before sending; reach every non-blocked student and/or recruiter ("All users" = students + recruiters; admins are senders); no link. "Sent announcements" is rebuilt by grouping announcement notifications with the same title, message and time; the audience shown is worked out from the recipients' roles.
- The bell count is read by `app-shell` (documented layer exception) and passed to the navbar; the notification page updates it with `setNotificationBadge`. Notification and announcement pages also refresh on the `storage` event (other tabs).
- Recruiter dashboard quick actions follow the sidebar, so they now include Notifications.

### Phase 10 Validation
- New suite `notify-test`: **68/68** — logged-out redirects (notification centre with shared returnTo, announcements); all three roles allowed on the centre; student / recruiter denied announcements; bell count + accessible name + link; dashboard "View all" link; student sees only own; unread text + style; type label, link, message, `<time>`; date groups; mark one (stored, badge hidden, count text, focus) and persistence after reload; service ownership (other user's id, unknown id, null, logged out); student B and recruiter B isolation; recruiter mark all (only own changed); click → marked read + navigates to own applicants page; link to another recruiter's job still shows "Job not found"; malformed / unsafe records (admin link for a student, `javascript:`, HTML title, missing title, bad date, unknown type, null entries) handled without crash; empty state; generation for all five events with exact recipients, schema keys and links; no notification for own apply, duplicate apply, refused transition, withdrawal, repeated approval, invalid rejection; announcements (validation with focus, confirm cancel / send, one per non-blocked student, sent list with audience and recipient count, all-users audience, service validation, non-admin refused, received by students only); repeated page loads create nothing; accessibility (button names, list roles, heading order, live count, bell); 360 / 375 / 768 / 1024 / 1280 (no horizontal scroll, bell fits); no console errors.
- Regression on the final code: Phase 1 42, auth 56, login 59, registration 57, navigation 79, guards 51, links 16, student dashboard 45, jobs 74, details 62, tracking 69, profile 127, recruiter 119, admin 85 — **941/941 passed**. Checks updated for intended Phase 10 changes: navbar now has a bell (nav); sidebar items no longer "Soon" (nav active-style comparison, recruiter sidebar + quick actions, admin sidebar); dashboard updates "View all" is a link; applying now adds a recruiter notification (profile suite).
- Static: imports/exports (46 modules), HTML references (19 pages), CSS tokens / braces / no hex colours, JSON, storage-access rule, no `console.log` / `var` / `innerHTML` — clean; `git diff --check` clean. No build step exists. Screenshots checked: notification centre 1280 + 360 (student, with bell), announcements 1280 (admin).

### Phase 10 Known Limitations
- Headless Edge only (cross-browser in Phase 13).
- The bell count is read when a page loads (and updated on the notification page); other open pages show a new count after navigation.
- Sent announcements are rebuilt from notifications, so deleting all recipients (or resetting data) removes them from the list, and the audience label is inferred from the recipients' roles.
- Notifications are never deleted except with their user (Phase 9) or by Reset demo data.

## Phase 11 Checklist (complete)

| ID | Task | Status |
|---|---|---|
| P11-T01 | `services/analytics-service.js`: student status breakdown, recruiter job analytics (applicants per job, status funnel), admin platform report, CSV text per report; pure helpers `toPercent`, `countByCategory`, `getStatusFunnel`, `groupByPeriod`, `toCsv`; config `APPLICATION_PIPELINE`, `REPORT_MAX_WEEKLY_POINTS`, `PAGE_PATHS.ADMIN_REPORTS`; utils `formatShortDate`, `formatMonth`, `toDateKey` | ✅ |
| P11-T02 | `components/charts.js`: bar, donut, line (SVG + HTML labels, no library); chart styles in `components.css` (colours from the status-badge tokens) | ✅ |
| P11-T03 | Student dashboard "Application status breakdown"; recruiter dashboard "Applicants per job" + "Application funnel" (`recruiter.css` `.analytics-grid`) | ✅ |
| P11-T04 | `pages/admin/reports.html` + `reports.js`: 4 reports with summary, chart, table and Export CSV; admin sidebar "Reports" available; report styles in `admin.css` | ✅ |
| P11-T05 | Validation, ownership tests, regression, documentation | ✅ |

### Phase 11 Acceptance Criteria (DEVELOPMENT_PHASES.md)

| Criterion | Result |
|---|---|
| Chart values match the underlying data | ✅ PASS (every chart, table and CSV compared with counts computed independently from `localStorage`; totals equal the admin dashboard; updates after approve / apply / status change / withdraw) |
| Every chart has a text/table alternative | ✅ PASS (reports: text summary + table per chart; dashboards: every bar shows its label and value as text; donut legend lists count and %; chart SVGs are `aria-hidden`) |
| CSV opens correctly in a spreadsheet application | ✅ PASS (exported files opened in Microsoft Excel through COM automation: correct rows / columns, numbers numeric, "33%" read as a percentage, ISO week dates read as dates; also parsed by PowerShell `Import-Csv`) |

### Phase 11 Decisions
- Scope exactly as specified: student = own application status breakdown (PROJECT_SPEC §3.2); recruiter = applicants per job + status funnel (§3.3); admin = users by role, jobs by status, applications by status, applications over time, tables, CSV (§3.4, UI_SPEC §5). No other metrics, no filters (none are specified), no new storage keys; nothing derived is stored.
- The user always comes from the session. Recruiter ownership is `application.jobId` → `job.recruiterId` (the copied `application.recruiterId` is ignored). Pending recruiters get no applicant data (as on the Applicants page) and see "Available after approval".
- All statuses are counted, including withdrawn (applications are historical records) and blocked / pending users; admin totals therefore equal the admin dashboard. Values that are not a known category are shown as "Other / unknown" so counts always add up.
- Funnel = applications that reached each forward stage (`applied → … → selected`), from the current status and the status history; percentages are of all applications to the recruiter's jobs. One colour (single measure).
- Applications over time uses `appliedAt`; weeks start on Monday; weekly while the data spans ≤ 16 weeks, otherwise monthly; empty periods are shown as 0; missing, unreadable, pre-2000 and future dates are listed as "Date missing or invalid" in the table / CSV instead of being plotted.
- Percentages: whole numbers (`Math.round`), 0 when the total is 0; rounded values may not add up to exactly 100.
- Chart forms: donut only for users by role (3 roles; palette passes a colour-vision check). Status data uses labelled bars, because the status colours (e.g. red / green for rejected / selected) are not distinguishable for everyone; every bar shows its value as text, and colours match the status badges.
- The line chart is drawn at its container's real width so text is never scaled down; one debounced window `resize` listener redraws it when the width changes (a first version with ResizeObserver + requestAnimationFrame did not redraw in headless testing, so it was replaced).
- CSV: one "Export CSV" per report, file `freshhire-<report>-<YYYY-MM-DD>.csv`, UTF-8 with BOM, CRLF, RFC 4180 quoting, text starting with `= + - @` prefixed with `'` (formula-injection guard), "Total" row; the over-time CSV uses ISO dates so spreadsheets read them as dates.
- Reports page re-renders on the `storage` event (other tabs), like the admin dashboard. Recruiter "Applicants per job" rows link to that job's Applicants page.

### Phase 11 Validation
- Baseline before Phase 11 (re-run at the start of this session): Phase 1 42, auth 56, login 59, registration 57, navigation 79, guards 51, links 16, student dashboard 45, jobs 74, details 62, tracking 69, profile 127, recruiter 119, admin 85, notifications 68 — **1009/1009**.
- New suite `analytics-test`: **116/116** — pure calculations (percentages incl. zero / invalid totals, category counts incl. empty / one / unknown / null records, funnel incl. rejected, withdrawn and missing history, weekly / monthly grouping with empty periods, the 16/17-week switch, invalid / pre-2000 / future dates, CSV quoting / BOM / CRLF / formula guard, axis ticks); chart component (no duplicates on re-render, bar scaling, value text, safe tone classes, text-only labels, donut segment lengths / single item / empty, line one SVG / one path / dots, redraw on resize, single point, empty); access (logged out → login with returnTo; student, recruiter and pending recruiter redirected by direct URL; every analytics service returns null outside its role; unknown / prototype report keys refused); admin report = raw storage counts and = admin dashboard; Reports page (spec order, donut / bars / line / tables equal the data, summaries, no NaN / undefined, one chart per report); CSV export (Blob, dated file name, rows equal tables for all 4 reports, toast, distinct button names); consistency after approve job, apply, status change, withdraw; live update from another tab without duplicates; empty data (empty states, zero tables, valid CSV with BOM bytes); corrupted data (Other / unknown, invalid dates listed, nothing injected); 400 records over two years (monthly, non-overlapping x labels, whole-number %); recruiter A / B isolation both ways, forged `application.recruiterId`, pending recruiter; student A / B isolation, student with no applications; accessibility (headings, aria-hidden SVGs with summaries + tables, table headers / scopes, values as text, focusable buttons, chart links); 360 / 375 / 768 / 1024 / 1280 on Reports and both dashboards (no horizontal scroll, charts inside the viewport and drawn at their width); resize redraw on the live page; no console errors / warnings.
- Regression on the final code: **1009/1009** (same 15 suites). Two checks updated for intended Phase 11 changes: student dashboard now has 7 section headings (new "Application status breakdown"); admin sidebar "Reports" is now a link instead of "Soon".
- Total: **1125/1125 passed**.
- Static: `node --check` on changed JS; imports/exports (49 modules), HTML references (20 pages); tag balance, duplicate ids and `aria-labelledby` targets on the 3 changed pages; CSS braces, no hex colours outside `variables.css`, no undefined tokens; JSON; storage-access rule; no `console.log` / `var` / `innerHTML` / inline styles or handlers — clean; `git diff --check` clean; new files have no trailing whitespace. No build step exists. Screenshots checked: Reports 1280 / 768 / 360, recruiter dashboard 1280 / 360, student dashboard 1280 / 360.

### Phase 11 Known Limitations
- Headless Edge only (cross-browser in Phase 13). Headless Edge does not fire `resize` in a test frame by itself, so the redraw test sends the event (as the earlier suites do); in browsers the redraw runs on real resize events.
- No official W3C HTML/CSS validator was run (no network / tools in this environment); the structural checks above were used instead.
- The time grouping (week / month) is automatic; there is no date-range filter (none is specified).
- Rounded percentages may add up to 99 % or 101 %.
- README.md was not updated in this phase (the phase request limited documentation changes to PROJECT_STATUS.md and DEVELOPMENT_PHASES.md); its status line still says Phase 10.

## Next Task

**Phase 12 — Responsive Design & UI Polish** (start only when the user explicitly approves).

## Known Issues / Open Questions

- None. Note: browsers block ES modules on `file://`, so the app must be opened through a static server (documented in README).

## Change Log

| Date | Phase | Change |
|---|---|---|
| 2026-09-29 | 0 | Created all planning documents. Phase 0 complete. |
| 2026-09-29 | 1 | Built folder structure, design system, core modules, seed data, shared components, and landing page. Added `components/icons.js` to ARCHITECTURE.md; clarified folder creation in Phase 1 (DEVELOPMENT_PHASES.md, ARCHITECTURE.md). Phase 1 complete. |
| 2026-09-29 | 2 | P2-T01: added `core/auth.js` and `services/user-service.js` (frontend-only simulated auth). ARCHITECTURE.md §1 notes that core `auth` may use `user-service`. Phase 2 in progress. |
| 2026-09-29 | 2 | P2-T02: login page, `auth.css`, `login.js`. Added `PAGE_PATHS`/`ROLE_HOME_PATHS` (config.js), `setFlash`/`consumeFlash` (storage.js), `getPostLoginPath()` (auth.js; temporary → index.html), eye/eyeOff/arrowLeft icons, flash toast on landing. UI_SPEC §3.1 notes the slim auth header. Phase 2 tasks renumbered (registration → P2-T03). |
| 2026-09-29 | 2 | P2-T03: `register.html`, `register.js`, `register()` in auth.js, registration validation + `createUser` in user-service, shared `components/form-field.js` (login.js now uses it; behaviour unchanged), `renderIconsBefore` in icons.js, registration constants + `SIMULATED_DELAY_MS` in config.js, login page accepts `?email=` and shows the flash toast. PROJECT_SPEC §4.1 documents registration field formats; ARCHITECTURE lists form-field.js. |
| 2026-09-29 | 2 | P2-T04: `components/sidebar.js` (role nav, path-based active item, Soon items, mobile drawer), `renderAppNavbar` in navbar.js (☰ toggle, logo, user menu, logout), nav icons, `keepFocusInside` exported from modal.js (modal uses it), app-shell/user-menu CSS in layout.css. ARCHITECTURE §1 notes the navbar's logout exception. |
| 2026-09-29 | 2 | P2-T05: role dashboard shells, `components/app-shell.js`, `requireRole` / `redirectIfLoggedIn` / `getPostLoginPath(role, returnTo)` in auth.js, Dashboard nav items available, login notice replaced by redirect, landing/register redirect logged-in users. P2-T06: Login/Register links on landing navbar, hero, recruiter CTA and login page; `?role=` pre-select on register. ARCHITECTURE §1/§2/§5/§6 and README updated. **Phase 2 complete.** |
| 2026-09-29 | 3 | Phase 3: student dashboard (stats, profile completeness, recent applications, recent updates, recommended jobs, quick actions); read-only application / saved-job / notification services; `getRecommendedJobs` + record hardening in job-service; `getProfileCompleteness` in user-service; `student.css`; job-card `note`. Docs: PROJECT_SPEC §3.2, UI_SPEC §5, ARCHITECTURE §7, README. **Phase 3 complete.** |
| 2026-09-29 | 4 | Phase 4 implementation: Browse Jobs page (search, filters, sort, pagination, Show expired, filter drawer, tab persistence), `searchJobs` / `getJobFilterOptions` in job-service, `paginate` in utils, `components/pagination.js`, sidebar "Browse Jobs" available. Docs: PROJECT_SPEC §3.2, UI_SPEC §5, ARCHITECTURE §7, README. |
| 2026-09-30 | 4 | P4-T03 re-run on final code: 479/479, static + `git diff --check` clean. **Phase 4 complete.** Phase 5 started (user-approved). |
| 2026-09-30 | 5 | Phase 5: Job Details page + apply modal; application-service apply/eligibility; job-service `getVisibleJob`; "View details" links on job cards; withdraw moved to Phase 6 (user decision). Docs: DEVELOPMENT_PHASES, PROJECT_SPEC §3.2, UI_SPEC §5, ARCHITECTURE §7, README. 541/541. **Phase 5 complete.** |
| 2026-09-30 | 6 | Phase 6: Saved Jobs page, My Applications page (filter, timeline, withdraw), shared save toggle, saved-job-service save/unsave, application-service withdraw, job-service availability; sidebar items available. Docs: PROJECT_SPEC §3.2, UI_SPEC §5, ARCHITECTURE §1/§2/§7, README. 610/610. **Phase 6 complete.** |
| 2026-09-30 | 7 | Phase 7: Profile & Resume page (tabs, per-tab save, completeness, skills, education, projects & links, resume upload/view/download/replace/remove, printable A4 resume); profile-service, user-service `updateStudentRecord`, tabs + resume-sheet components; sidebar/user-menu Profile available; Job Details resume link. Docs: PROJECT_SPEC §3.2, UI_SPEC §5, ARCHITECTURE §2/§7, README. 737/737. **Phase 7 complete.** |
| 2026-09-30 | 8 | Phase 8: Recruiter Portal — dashboard, Post / Edit Job (preview, BR-07/08/11), My Jobs (filter, close BR-10), Applicants (status flow BR-15/16, profile + resume dialog), Company Profile; job-service / application-service / profile-service / user-service recruiter functions; approval-banner component; recruiter.css; shared dashboard CSS moved to components.css. Docs: PROJECT_SPEC §3.3, UI_SPEC §5, ARCHITECTURE §2/§7, README. 856/856. **Phase 8 complete.** |
| 2026-09-30 | 9 | Phase 9: Admin Portal — dashboard (totals, jobs by status, pending quick lists, reset demo data), Users (search, filters, approve / block / unblock / delete with cleanup), Moderate Jobs (filter, view, approve / reject with reason / delete); admin-service; `ensureSeeded({ force })`; admin.css; shared table CSS moved to components.css. Docs: DEVELOPMENT_PHASES, PROJECT_SPEC §3.4, ARCHITECTURE §2/§7, README. 941/941. **Phase 9 complete.** |
| 2026-09-30 | 10 | Phase 10: Notifications — notification-service (own list, unread count, mark read / all, safe links, create), §4.5 events wired into application-service and admin-service, navbar bell (app-shell → navbar), shared notification centre, admin Announcements (send + sent list); sidebar Notifications / Announcements available. Docs: DEVELOPMENT_PHASES, ARCHITECTURE §1, README. 1009/1009. **Phase 10 complete.** |
| 2026-09-30 | 11 | Phase 11: Analytics & Reports — analytics-service (student breakdown, recruiter applicants per job + funnel, admin platform report, CSV), components/charts.js (SVG bar / donut / line), student and recruiter dashboard analytics sections, admin Reports page with tables and CSV export; sidebar Reports available. Docs: DEVELOPMENT_PHASES, PROJECT_STATUS. 1125/1125. **Phase 11 complete.** |
