# FreshHire API

Base URL: `<server>/api` — locally `http://localhost:5000/api`.

## Conventions

- **Requests:** JSON bodies (`Content-Type: application/json`, at most 100 KB). The one exception is
  the resume upload, which sends the PDF itself as the body.
- **Login:** send `Authorization: Bearer <token>` (the token comes from `POST /auth/login`).
- **Success:** `{ "ok": true, "data": … }` with status 200 (201 when something was created).
- **Failure:** `{ "ok": false, "code": "…", "error": "message for the user", "fieldErrors": { … } }`.
  `fieldErrors` (field name → message) is present for form validation errors.
- **Ids** are 24-character strings. A malformed or unknown id, and a record that belongs to someone
  else, all give `404 NOT_FOUND`.
- **Lists** accept `page` (from 1) and `limit` (at most 100) and return
  `page, limit, total, totalPages, from, to` next to `items`.
- The acting user is always the owner of the token. Fields such as `studentId`, `recruiterId`, `role`
  or `status` in a request are ignored.

| Status | Codes |
|---|---|
| 400 | `VALIDATION_FAILED`, `MISSING_FIELDS`, `ROLE_NOT_ALLOWED`, `INVALID_FILE`, `INVALID_SECTION`, `INVALID_JSON`, `INVALID_INPUT` |
| 401 | `UNAUTHENTICATED` (no / invalid / expired token, or the account was blocked or deleted), `INVALID_CREDENTIALS` |
| 403 | `NOT_ALLOWED` (wrong role), `NOT_APPROVED` (recruiter still pending), `ACCOUNT_BLOCKED`, `FEATURE_DISABLED` |
| 404 | `NOT_FOUND`, `JOB_NOT_FOUND`, `NO_RESUME` |
| 409 | `ALREADY_APPLIED`, `JOB_EXPIRED`, `NOT_ELIGIBLE`, `CANNOT_WITHDRAW`, `INVALID_TRANSITION`, `CANNOT_EDIT`, `CANNOT_CLOSE`, `JOB_CHANGED`, `INVALID_ACTION` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 429 | `RATE_LIMITED` |
| 500 / 503 | `SERVER_ERROR`, `SERVICE_UNAVAILABLE` (database unreachable) |

## Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `200` while the API can reach the database, otherwise `503`. Used by Render. |
| GET | `/public/landing` | `{ stats, featuredJobs }` — numbers and the six newest open jobs |

## Authentication

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/auth/register` | anyone | Body: `role` (`student` or `recruiter`), `name`, `email`, `phone`, `password`, `confirmPassword`, and the role's fields (`college, degree, branch, graduationYear, cgpa` or `companyName, designation, companyWebsite, companyLocation`). Students start `active`, recruiters `pending`. Never creates an admin. Returns `{ user, isPendingApproval }` — no token. |
| POST | `/auth/login` | anyone | Body: `email`, `password`. Returns `{ token, user, isPendingApproval }`. Same error for a wrong password and an unknown email. |
| POST | `/auth/logout` | logged in | Ends every session of the user (older tokens stop working). |
| GET | `/auth/me` | logged in | `{ user, unreadCount }` — the current account as stored now |

Per IP address in 15 minutes, at most `AUTH_RATE_LIMIT_MAX` (20) **failed** logins and the same number of
registrations are accepted; after that the answer is `429 RATE_LIMITED`. Successful logins are not counted.

`user`: `id, role, name, email, phone, status, createdAt, profile` and, for students, `completeness`
(`{ percent, missing[] }`). The password hash is never returned.

## Student

All routes need a student token.

| Method | Path | Description |
|---|---|---|
| GET | `/jobs` | Search approved jobs. Query: `query`, `location`, `jobType`, `workMode`, `payRange`, `skills` (comma-separated), `includeExpired=true`, `sort` (`newest`, `deadline`, `salary`), `page`, `limit`. Each job has `isSaved` and `isExpired`. |
| GET | `/jobs/filter-options` | `{ locations[], skills[] }` taken from approved jobs |
| GET | `/jobs/:jobId` | `{ job, isSaved, application, eligibility: { isEligible, rules[] }, applyStatus: { canApply, code, message } }`. Only approved jobs. |
| POST | `/jobs/:jobId/applications` | Apply. Body: `coverNote` (optional, ≤ 1,000). Checks approval, deadline, one application per job and eligibility. |
| GET | `/student/dashboard` | `{ stats, recentApplications, statusBreakdown, notifications, recommended }` |
| GET | `/student/applications` | Own applications: `items[{ application, job, availability }]`, `counts` per status. Query: `status`, `page`, `limit`. |
| POST | `/student/applications/:applicationId/withdraw` | Only from `applied` / `under_review` |
| GET | `/student/saved-jobs` | `items[{ record: { jobId, savedAt }, job, availability }]` |
| PUT | `/student/saved-jobs/:jobId` | Save an approved job (saving twice is harmless) |
| DELETE | `/student/saved-jobs/:jobId` | Remove the saved link (works even if the job is gone) |
| PATCH | `/student/profile/:section` | `section`: `personal`, `education`, `skills` or `projects`. Body: that tab's fields. Returns the updated user. |
| GET | `/student/resume` | The student's own PDF |
| PUT | `/student/resume` | Body: the PDF (`Content-Type: application/pdf`, ≤ 500 KB); `X-File-Name`: URL-encoded file name. The content must really be a PDF. Returns the updated user. |
| DELETE | `/student/resume` | Remove the resume |

`availability`: `open`, `expired`, `closed` or `unavailable`. For `closed` / `unavailable` the `job` is
only `{ id, title, companyName }`, or `null` when the job was deleted.

## Recruiter

All routes need a recruiter token. Routes marked **active** also need an approved account
(`403 NOT_APPROVED` otherwise).

| Method | Path | Description |
|---|---|---|
| GET | `/recruiter/dashboard` | `{ stats, recentApplicants, analytics: { isActive, totalApplicants, jobs[], funnel } }` |
| GET | `/recruiter/jobs` | Own jobs: `items[{ job, applicantCount }]`, `counts`. Query: `status`. |
| PATCH | `/recruiter/profile` | Body: `name, phone, companyName, designation, companyWebsite, companyLocation, companySize, industry, about` |
| POST | `/recruiter/jobs` | **active.** Create a job (saved as `pending`). Body: `title, location, jobType, workMode, experience, openings, deadline, salaryPeriod, salaryMin, salaryMax, description, responsibilities[], skills[], degrees[], graduationYears[], minCgpa`. |
| GET | `/recruiter/jobs/:jobId` | **active.** One own job |
| PATCH | `/recruiter/jobs/:jobId` | **active.** Edit an own `pending` / `approved` job. Returns `{ job, returnedToPending }`. |
| POST | `/recruiter/jobs/:jobId/close` | **active.** Close an own `approved` job |
| GET | `/recruiter/jobs/:jobId/applications` | **active.** `{ job, items[{ application, candidateName }] }` |
| GET | `/recruiter/applications/:applicationId` | **active.** `{ application, job, candidate }` for an application to an own job |
| GET | `/recruiter/applications/:applicationId/resume` | **active.** The applicant's current PDF |
| PATCH | `/recruiter/applications/:applicationId/status` | **active.** Body: `status` — the next step or `rejected` |

## Admin

All routes need an admin token.

| Method | Path | Description |
|---|---|---|
| GET | `/admin/dashboard` | `{ stats, pendingRecruiters, pendingJobs, demoResetEnabled }` |
| GET | `/admin/users` | Query: `query` (name, email, company), `role`, `status`, `page`, `limit`. Each user has `actions: { approve, block, unblock, remove }`. |
| POST | `/admin/users/:userId/approve` | Pending recruiter → `active` |
| POST | `/admin/users/:userId/block` | `active` → `blocked` |
| POST | `/admin/users/:userId/unblock` | `blocked` → `active` |
| DELETE | `/admin/users/:userId` | Delete the account and its related data. Admin accounts cannot be changed or deleted. |
| GET | `/admin/jobs` | Query: `status`, `page`, `limit`. `items[{ job, recruiterName, applicantCount }]`, `counts`. |
| POST | `/admin/jobs/:jobId/approve` | Only `pending` jobs |
| POST | `/admin/jobs/:jobId/reject` | Only `pending` jobs. Body: `reason` (1–300 characters). |
| DELETE | `/admin/jobs/:jobId` | Delete a job; its applications remain as history |
| GET | `/admin/announcements` | Sent announcements |
| POST | `/admin/announcements` | Body: `audience` (`all`, `students`, `recruiters`), `title`, `message` |
| GET | `/admin/reports` | `{ usersByRole, jobsByStatus, applicationsByStatus, applicationsOverTime }` |
| POST | `/admin/reset-demo-data` | Erase everything except admin accounts and import the demo data. `403 FEATURE_DISABLED` unless `ALLOW_DEMO_RESET=true`. |

## Notifications

Any logged-in user; always the user's own.

| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | `items`, `unread`, paging |
| GET | `/notifications/unread-count` | `{ unread }` |
| POST | `/notifications/:notificationId/read` | `{ changed, unread }` |
| POST | `/notifications/read-all` | `{ changed, unread }` |

Notifications are created by the server when a student applies (→ the job's recruiter), an application
status changes (→ the student), a job is approved or rejected (→ its recruiter), a recruiter is
approved (→ the recruiter) and when an admin sends an announcement (→ the audience).
