# FreshHire — A Frontend-Only Job Portal for Freshers

**Project report** · Final-year college project

---

## 1. Title

**FreshHire: a simulated job portal for freshers, built with HTML5, CSS3 and Vanilla JavaScript.**

## 2. Abstract

FreshHire is a multi-role web application that helps freshers find entry-level jobs and internships, apply to
them and follow their applications, while recruiters publish jobs and review applicants and an administrator
moderates the platform. The whole system runs in the web browser: pages are static HTML, behaviour is written in
Vanilla JavaScript ES modules, demo data is loaded from JSON files into `localStorage`, and the login session is
kept in `sessionStorage`. There is no backend, database or API; server behaviour (authentication, approvals,
notifications, analytics) is simulated in a layered client-side architecture with a clear service layer. The
project covers 20 pages for three roles, business rules for eligibility, application status flow and ownership,
in-app notifications, hand-drawn SVG charts with CSV export, and a responsive, accessible interface. It was tested
with automated browser test suites in Microsoft Edge, Firefox and Chrome, a layout audit at eight screen widths,
keyboard and mobile-emulation checks, and Lighthouse accessibility audits (score 100 on all key pages).

## 3. Introduction

Freshers often search many websites, apply without knowing whether they are eligible, and lose track of where
their applications stand. Recruiters of small companies need a simple place to post jobs and move candidates
through a hiring process. FreshHire brings these activities into one portal with three roles — **Student**,
**Recruiter** and **Admin** — and was built phase by phase (Phases 0–14) with documented requirements, rules and
acceptance criteria.

## 4. Problem statement

Build a job portal for freshers that supports registration and login for different roles, job search with
filters, eligibility checks, applications with status tracking, recruiter job and applicant management, admin
moderation, notifications and reports — **using only client-side web technologies**, without any server,
database or framework, while keeping the application usable on phones and accessible to keyboard and
screen-reader users.

## 5. Objectives

1. Demonstrate a complete multi-role web application with client-side technologies only.
2. Model realistic hiring workflows: registration, approval, job posting, application, status changes.
3. Enforce business rules (eligibility, status flow, ownership) consistently in one service layer.
4. Provide a clean, responsive (360px and up) and accessible user interface.
5. Keep the code readable and explainable: small modules, clear names, no hidden framework behaviour.

## 6. Scope

**In scope:** three roles; landing page; registration and login; student dashboard, job search, job details,
applying, saved jobs, application tracking and withdrawal, profile and resume; recruiter dashboard, job posting and
editing, closing jobs, applicant management, company profile; admin dashboard, user management, job moderation,
announcements, reports with CSV export, demo-data reset; in-app notifications; analytics charts.

**Out of scope** (PROJECT_SPEC §1.2): real authentication or encryption, email/SMS, data shared between devices or
users, payments, chat, video interviews, any server, database or third-party API.

## 7. Existing system

Freshers typically rely on general job websites, social media and word of mouth. These are designed for all
experience levels, show many jobs a fresher cannot apply to, and do not check academic eligibility before
applying. Tracking applications across sites is manual. Small recruiters often manage applicants in spreadsheets
or email.

## 8. Proposed system

FreshHire focuses on freshers: every job carries eligibility rules (degrees, graduation years, minimum CGPA) that
are checked before applying, applications have a visible status timeline, and recruiters move candidates through a
defined status flow. An admin approves recruiters and jobs before students see them. Everything is demonstrated
in the browser, so the system can be run anywhere with only a static file server.

## 9. Technology stack

| Layer | Technology |
|---|---|
| Markup | HTML5 (semantic elements, one page per screen) |
| Styling | CSS3 — custom properties (design tokens), Flexbox, Grid, media queries |
| Logic | Vanilla JavaScript ES6+ modules (no framework, no build step) |
| Data | JSON seed files in `/data`, copied to `localStorage` on the first visit |
| Session | `sessionStorage` (per browser tab) |
| Charts | Hand-written inline SVG (bar, donut, line) |
| Icons | Inline SVG |
| Serving | Any static file server (e.g. VS Code Live Server) |

Not used: Node.js, databases, BaaS, React / Angular / Vue / jQuery, Bootstrap / Tailwind, chart libraries, CDNs,
npm. (The static server only delivers files.)

## 10. System architecture

```
Presentation:  HTML pages ──▶ page scripts (assets/js/pages/…)
                                 │
Components:        navbar, sidebar, modal, toast, job card, pagination, tabs, charts, …   (DOM only)
                                 │
Services:          user · profile · job · application · saved-job · notification · admin · analytics
                   (all business rules; the acting user always comes from the session)
                                 │
Core:              config (keys, constants) · storage (only module touching browser storage)
                   auth (login, session, page guards) · seed (loads JSON) · utils
                                 │
Browser storage:   localStorage (fh_users, fh_jobs, fh_applications, fh_saved_jobs, fh_notifications)
                   sessionStorage (fh_session, fh_job_filters, fh_flash)
                                 ▲
Seed data:         /data/*.json (fetched once on the first visit, or when the data version changes)
```

Layer rules (ARCHITECTURE.md §1): pages use components, services and core; components never read storage;
services never touch the DOM; only `core/storage.js` calls `localStorage` / `sessionStorage`. Every protected
page starts through `components/app-shell.js`: seed data → role guard → navbar, sidebar, footer → page content.

## 11. Functional modules

| Module | Main parts |
|---|---|
| Public | Landing page (hero, how it works, stats, featured jobs), login, registration (student / recruiter) |
| Authentication | `core/auth.js`: register, login, logout, session, `requireRole`, safe `returnTo` |
| Student | Dashboard, Browse Jobs, Job Details + apply, Saved Jobs, My Applications, Profile & Resume |
| Recruiter | Dashboard, Post / Edit Job, My Jobs, Applicants (profile, resume, status), Company Profile |
| Admin | Dashboard, Users, Moderate Jobs, Announcements, Reports, Reset demo data |
| Notifications | Bell with unread count, notification centre for every role, mark read / mark all read |
| Analytics | Student status breakdown, recruiter applicants per job and funnel, admin reports with CSV |

## 12. User roles

| Role | Created by | Starts as | Notes |
|---|---|---|---|
| Student | Self-registration | `active` | Can apply once per job |
| Recruiter | Self-registration | `pending` | Can log in, but posting and applicants unlock after admin approval |
| Admin | Seed data only | `active` | Cannot be registered, blocked or deleted |

Any `blocked` account is refused at login.

## 13. Major features

**Student:** skill-matched job recommendations; search across title, company and skills; filters (location, job
type, work mode, pay range, skills) with sort and 9-per-page pagination; expired jobs hidden unless requested;
job details with a per-rule eligibility check; apply with cover note (resume name attached automatically);
save / unsave; application timeline and status filter; withdraw while *Applied* / *Under Review*; profile with
completeness score (15 items); PDF resume upload (≤ 500 KB) and printable A4 resume; notifications; application
status chart.

**Recruiter:** approval banner while pending; job form with preview; new and core-edited jobs go back to the admin
as *Pending*; close jobs; applicant table with the allowed next statuses; candidate profile and resume viewer;
company profile; applicants-per-job chart and application funnel.

**Admin:** platform totals; approve recruiters; block / unblock / delete users with cleanup of related data;
approve / reject (with reason) / delete jobs; announcements to chosen audiences; four reports with tables and CSV
export; reset demo data.

**Cross-cutting:** notifications for five events (new application → recruiter; status change → student; job
approved / rejected → recruiter; recruiter approved → recruiter; announcement → audience); responsive layout with
an off-canvas navigation drawer on small screens; confirmation dialogs for destructive actions; toasts for
feedback; empty states instead of blank areas.

## 14. Data model

Stored as JSON arrays in `localStorage` (full field lists in PROJECT_SPEC §5):

| Collection | Key fields |
|---|---|
| `fh_users` | `id`, `role`, `name`, `email`, `password` (plain text, demo only), `phone`, `status`, `createdAt`, `profile` (student: college, degree, branch, graduation year, CGPA, skills, education, projects, links, resume; recruiter: company details) |
| `fh_jobs` | `id`, `recruiterId`, `title`, `companyName`, location, type, work mode, pay, skills, description, responsibilities, `eligibility`, openings, `deadline`, `status`, `rejectionReason`, dates |
| `fh_applications` | `id`, `jobId`, `studentId`, `coverNote`, `resumeFileName`, `status`, `statusHistory[]`, dates |
| `fh_saved_jobs` | `studentId`, `jobId`, `savedAt` |
| `fh_notifications` | `id`, `userId`, `type`, `title`, `message`, `link`, `read`, `createdAt` |
| `fh_session` (sessionStorage) | `userId`, `role`, `name`, `loginAt` |

"Expired" is never stored; it is computed from the deadline (BR-12). There is **no real database**.

## 15. Authentication and authorization

Login checks the email and password against `fh_users`, refuses blocked accounts and stores a session in
`sessionStorage`. Every protected page runs a role guard before it is shown. Services re-check the acting user on
every operation: students act only on their own data, recruiters only on their own jobs and the applications to
them (ownership through `job.recruiterId`), pending recruiters cannot post or see applicants, and only the admin
can approve, reject, block or delete. Because all of this runs in the browser, it is a **simulation**, not real
security — see [SECURITY.md](SECURITY.md).

## 16. Testing

Testing combined automated browser test pages (run headless), accessibility and layout tools, and scripted
keyboard and mobile checks. The test pages were kept in the development environment and are **not included in
the repository**. Results recorded in Phase 13:

| Check | Result |
|---|---|
| Automated test suites — Microsoft Edge 154 (final code) | 19 suites, **1254 checks, 1254 passed, 0 failed**; the framework has no "skipped" state |
| Same suites — Firefox 157 (final code) | **1254 / 1254 passed** |
| Same suites — Chrome for Testing 154 | **1247 / 1247 passed** (18 suites, before the last three Phase 13 fixes; Chrome could not be re-run afterwards) |
| Layout audit, 30 page/role views × 8 widths (360–1440px) | 240 renders: no horizontal scroll, no unlabelled controls or nameless buttons, no small targets, correct headings, no console errors |
| Lighthouse 13.5.0 accessibility, 20 key pages, desktop + mobile | **100** on all 40 runs |
| Keyboard (real Tab / Enter / Escape, 20 pages + dialog + drawer) | 22 / 22 |
| Mobile device emulation (6 profiles, touch input) | 24 / 24 |

What the suites cover: landing and shared components; registration, login and session; navigation and the role
guard of every page for every visitor type; student dashboard, search, filters, pagination, job details,
applying, saved jobs, tracking and withdrawal; profile and resume; recruiter portal and two-recruiter isolation;
admin portal; notifications and their ownership; analytics and CSV export; responsive layout and accessibility;
end-to-end journeys across roles with page reloads; empty, corrupted and full storage; invalid URL parameters;
long user-entered text.

**Defects found and fixed in Phase 13:** (1) the focus ring of form fields was almost invisible (1.12:1 contrast)
and missing on the date field's calendar button — now 3.4:1; (2) the company-size select was cut off at desktop
width — the field now has its own row; (3) very long words (e.g. a long email) could widen pages and cause
sideways scrolling — text now wraps inside long words when needed.

**Not completed:** Phase 13 was stopped before its written test-case catalogue (`docs/TEST_CASES.md`) and its
final validation write-up; see PROJECT_STATUS.md.

## 17. Results

All planned features of Phases 1–12 are implemented and work across three roles. The automated tests pass in
Edge, Firefox and Chrome; no page scrolls sideways from 360px to 1440px; Lighthouse rates every key page 100 for
accessibility; and the application runs from any static file server with no installation.

## 18. Limitations

- Frontend-only: data lives in one browser and is not shared between users, browsers or devices.
- Not secure: plain-text demo passwords in `localStorage`; any user can inspect or change data with DevTools.
- `localStorage` holds about 5 MB, so resumes are limited to 500 KB and large resumes can fill the storage.
- No email, SMS or real-time notifications; other open tabs see new data after a reload (admin pages refresh on
  storage changes).
- Minimum supported width 360px; must be served over HTTP by a static server.
- Automated tests are not part of the repository; Phase 13's written test-case document was not produced.

## 19. Future scope

A real backend API and database; secure authentication (hashed passwords, server sessions or signed tokens over
HTTPS); server-side authorization on every request; cloud storage for resumes; email and real-time
notifications; verified recruiter onboarding; richer search and recommendations; production deployment with
monitoring. The existing service layer maps naturally to API endpoints.

## 20. Conclusion

FreshHire shows that a realistic, multi-role job portal — with business rules, moderation, notifications,
analytics, responsive design and accessibility — can be designed and explained using only HTML, CSS and Vanilla
JavaScript. Its layered structure (pages → components → services → storage) keeps rules in one place and makes the
path to a real backend clear, while its honest limitations show where a production system would need a server and
real security.
