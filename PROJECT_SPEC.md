# PROJECT_SPEC.md — FreshHire Functional Specification

## 1. Overview

**FreshHire** is a simulated job portal that helps **freshers** (final-year students and recent graduates) discover entry-level jobs and internships, apply to them, and track their applications. Recruiters post jobs and manage applicants; an Admin moderates users and jobs.

> **FreshHire is a full-stack project (since Phase 15).** The frontend is HTML5, CSS3 and Vanilla JavaScript
> (ES6+); it talks to an Express REST API that stores all data in MongoDB. The login token is kept in the
> browser's `sessionStorage`. Demo data comes from JSON files imported once by a seed script.
> Every business rule in §4 is enforced by the API; the pages only show the result.
> (Phases 0–14 were a frontend-only simulation with the data in `localStorage`.)

### 1.1 Objectives
1. Demonstrate a complete, multi-role web application: a vanilla frontend, a REST API and a database.
2. Provide a clean, responsive, accessible UI.
3. Implement real portal workflows: registration, login, job search, applications, moderation, notifications,
   analytics — with authentication, authorization and validation on the server.

### 1.2 Out of Scope
- Production-grade security (email verification, password reset, two-factor login, audits) — see docs/SECURITY.md
- Real email/SMS delivery
- Real-time updates (pages show new data when they load)
- Payments, chat, video interviews
- Paid services or third-party APIs

## 2. Roles

| Role | How the account is created | Initial status | Can log in? |
|---|---|---|---|
| Student | Self-registration | `active` | Yes |
| Recruiter | Self-registration | `pending` (until Admin approves) | Yes, with limited access while `pending` |
| Admin | Seed script only (cannot register) | `active` | Yes |

Any user with status `blocked` cannot log in.

## 3. Features by Role

### 3.1 Public (not logged in)
- Landing page: hero, how it works, featured approved jobs (read-only preview), call-to-action to register/login.
- Login page (email + password + role is detected from the account).
- Registration page with a Student / Recruiter toggle.

### 3.2 Student
| Feature | Phase |
|---|---|
| Dashboard: welcome, quick stats (applied, shortlisted, saved, profile completeness), recent applications, recommended jobs | 3 |

*Dashboard definitions (Phase 3):* **Applications** = all of the student's applications (any status); **Shortlisted** = applications currently in status `shortlisted`; **Saved jobs** = the student's saved-job records; **Profile completeness** = share of 15 equally weighted items (name, email, phone, college, degree, branch, graduation year, CGPA, location, about, ≥1 skill, ≥1 education entry, ≥1 project, any profile link, resume). **Recommended jobs** = approved, non-expired jobs not yet applied to, ranked by number of matching skills then newest. All figures use only the logged-in student's own records.
| Browse approved jobs; keyword search; filters (location, job type, work mode, salary/stipend range, skills); sort (newest, deadline, salary); pagination | 4 |

*Job search rules (Phase 4):* **Search** covers title, company and skills; case-insensitive; extra spaces ignored; every typed word must appear. **Filters** combine with AND. **Location** is an exact (case-insensitive) match from the list of locations in the data. **Salary / stipend** ranges (`PAY_RANGES` in config.js) each belong to one pay period (monthly stipend or yearly salary); a job matches when its pay range overlaps the chosen range; undisclosed pay never matches a range. **Skills**: a job must list every selected skill. **Sort**: newest (default), deadline (soonest first), salary (highest first; monthly amounts ×12 for comparison; undisclosed last). 9 jobs per page; any search/filter/sort change returns to page 1. Expired jobs hidden unless "Show expired" is ticked (BR-12). The last used search/filters/sort/page are kept for the tab in `fh_job_filters` (sessionStorage).
| Job details page with eligibility check | 5 |
| Apply with an optional cover note (≤ 1,000 characters; resume reference attached automatically if on the profile) | 5 |
| Withdraw an application | 6 |
| Save / unsave jobs; Saved Jobs page | 6 |
| My Applications page with status timeline and status filter | 6 |

*Saved jobs & tracking rules (Phase 6):* only approved jobs (expired included) can be saved; unsaving always works, including for jobs that were later closed or removed; saved links are never deleted automatically. Withdrawing needs a confirmation and is allowed only from `applied` / `under_review` (BR-15); it appends a history entry "Withdrawn by student." (BR-16) and still blocks re-applying (BR-13). Applications are historical records: they stay listed when their job expires, closes or disappears. The student for every save, unsave and withdraw is taken from the session.
| Profile: personal, education, skills, projects, links; profile completeness % | 7 |
| Resume: upload PDF (≤ 500 KB, stored on the server) **or** build a simple resume from profile data and print it | 7 |

*Profile rules (Phase 7):* the student edits only their own profile (taken from the session). Each tab saves its own section; `id`, `role`, `email` (login ID, shown read-only), `password`, `status` and `createdAt` can never change here. **Personal:** name (required, ≤ 100), phone (required, 10 digits — same rules as registration), location (≤ 100), about (≤ 1,000). **Education:** college, degree, branch, graduation year and CGPA with the registration rules (+ ≤ 100 characters for text); up to 5 extra entries, each with level (required, ≤ 50), institute (required, ≤ 100), year of passing (required, 1980 to current year + 5) and score (optional, ≤ 20). **Skills:** up to 30, each 1–40 characters, no duplicates ignoring letter case; added/removed in the list and stored when the student selects Save. **Projects & links:** up to 5 projects (title required ≤ 100, description ≤ 500, optional link); LinkedIn, GitHub, portfolio and project links are optional but must be `http://` or `https://` URLs (so `javascript:` and similar can never be stored); links are shown as text, not clickable. **Resume:** PDF only (`application/pdf`, and the content must really be a PDF), 1 byte to 500 KB; the file is stored on the server and the profile holds `profile.resume` `{ fileName, sizeBytes, uploadedAt }`; a failed upload keeps the previous resume; removing asks for confirmation; viewing/downloading fetches the file with the login token and shows it from a temporary in-browser `blob:` URL — it has no public address. Applications keep the `resumeFileName` recorded when they were sent (BR-17), so replacing or removing a resume never changes them. The printable resume is generated from the saved profile; printing the Profile page prints only that resume (A4).
| Notifications (bell + notifications page) | 10 |
| Personal analytics (application status breakdown chart) | 11 |

### 3.3 Recruiter
| Feature | Phase |
|---|---|
| Dashboard: stats (active jobs, total applicants, shortlisted, pending approval), recent applicants | 8 |
| "Awaiting admin approval" banner while account is `pending`; job posting disabled | 8 |
| Post a job (goes to Admin as `pending`); edit own jobs; close a job | 8 |
| My Jobs page with status filter | 8 |
| Applicants page per job: view student profile/resume, change application status | 8 |
| Company profile page | 8 |
| Notifications | 10 |
| Job-level analytics (applicants per job, status funnel) | 11 |

*Recruiter rules (Phase 8):* the recruiter is always the logged-in user (session); URL ids and form fields never decide ownership. A job belongs to `job.recruiterId`; an application belongs to the recruiter of its job (`application.jobId` → `job.recruiterId` — the copied `application.recruiterId` is not trusted). **Pending recruiters** can log in, see the approval banner and edit their company profile, but cannot post, edit or close jobs or open applicants (BR-07); blocked recruiters cannot log in. **Dashboard stats:** Active jobs = own `approved`, non-expired jobs; Total applicants = all applications to own jobs (any status); Shortlisted = those currently `shortlisted`; Pending approval = own `pending` jobs; recent applicants = 5 newest by application date. **Job posting rules:** title (required, ≤ 100), location (required, ≤ 100), job type, work mode, experience (required, ≤ 50, e.g. "Fresher"), openings (1–1,000), deadline (today or later), pay period (internships must be per month), pay min/max in whole rupees (both empty = "Not disclosed"; max ≥ min; only min = fixed amount), description (required, ≤ 2,000), up to 10 responsibilities (≤ 200 each), 1–15 skills (≤ 40, no duplicates ignoring case), eligibility degrees from the degree list, graduation years, minimum CGPA 0–10 (all optional = open to all). The company name is copied from the recruiter's profile when the job is created and is not changed by later edits. New jobs are `pending` (BR-08) and a preview is shown before submitting. **Editing:** only own `pending` or `approved` jobs; `rejected` and `closed` jobs are final for the recruiter; id, owner, company, status, posting date and rejection reason are kept; editing a core field (title, description, eligibility, salaryMin/salaryMax/salaryPeriod) of an `approved` job returns it to `pending` (BR-11). A recruiter can never set `approved`. **Closing:** own `approved` jobs only, with confirmation; applications are kept (BR-10). There is no recruiter delete (deleting jobs is an admin action, Phase 9). **Application status:** from each status the recruiter may choose only the next step or `rejected` (`applied → under_review → shortlisted → interview → selected`); `selected` and `rejected` need a confirmation and are final; `withdrawn` applications cannot be changed. Every change appends `{ status, at, note: "" }` to `statusHistory` (BR-16). **Candidate data:** name, email, phone and profile (education, skills, projects, links, about) of applicants to own jobs only — never the password, account status or dates; the resume file is opened only through the application (own job), as a temporary `blob:` URL. **Company profile:** name, phone, company name, designation, website (http/https only, shown as a link that opens in a new tab), company location, company size (1-10, 11-50, 51-200, 201-500, 500+), industry (≤ 100) and about (≤ 1,000); email, role, status, password, id and createdAt cannot change.

### 3.4 Admin
| Feature | Phase |
|---|---|
| Dashboard: platform totals (students, recruiters, jobs by status, applications) | 9 |
| Manage users: search, filter by role/status, approve recruiters, block/unblock, delete | 9 |
| Moderate jobs: approve / reject (with reason) / delete | 9 |
| Reset demo data to seed state (with confirmation) | 9 |

*Admin rules (Phase 9):* every admin action takes the admin from the session and is refused for any other role. **Dashboard totals:** students, recruiters, jobs (and jobs per status), applications, all counted from stored data; quick lists of pending recruiters and pending jobs link to Users / Jobs. **Users:** search (name, email, company) and role/status filters. Actions per account — pending recruiter: Approve (→ `active`) or Delete; `active`: Block (→ `blocked`) or Delete; `blocked`: Unblock (→ `active`) or Delete. Admin accounts (including the admin's own) have no actions (BR-06: admins are seed-only). Delete removes the account and its related data: a student's applications, saved jobs and notifications; a recruiter's jobs, every application and saved link for those jobs, and their notifications. Passwords are never shown. **Jobs:** status filter; View shows the full job; Approve / Reject only for `pending` jobs (BR-09); Reject needs a reason (1–300 characters) that the recruiter sees on My Jobs; Delete removes only the job — its applications and saved links stay as history ("Job no longer available", as in §3.2). Approving keeps the owner, company and every recruiter-entered field. **Confirmation** is required for Block, Delete (users and jobs), Reject (reason dialog) and Reset demo data. **Reset demo data** (BR-20) works only on a server started with `ALLOW_DEMO_RESET=true`; the button is disabled elsewhere. It loads the seed files first, then deletes everything except admin accounts and imports the demo data; the admin stays logged in.
| Send announcements (to all users, all students, or all recruiters) | 10 |
| Reports page: charts and tables; export a report as CSV (client-side download) | 11 |

## 4. Business Rules

### 4.1 Accounts & Authentication
- **BR-01** Email must be unique (case-insensitive) across all users.
- **BR-02** Password: minimum 8 characters, at least one uppercase letter, one lowercase letter, and one digit.
- **BR-03** Login checks the email and the password's bcrypt hash on the server. `blocked` users are refused with a clear message, and a blocked user's open session ends on their next request.
- **BR-04** On successful login the server issues a signed token valid for 2 hours; it is kept in `sessionStorage` (`fh_session`), so closing the tab ends the session. Logging out makes the user's tokens stop working.
- **BR-05** Every protected page runs a role guard: no session → redirect to login; wrong role → redirect to that user's own dashboard. **The guard is presentation only:** every API route checks the token, the role and the ownership of the data again.
- **BR-06** Admin accounts cannot be created through registration; the API refuses any role other than student or recruiter.

*Registration field formats (input validation, not business rules):* all fields in UI_SPEC §5 "Register" are required except the recruiter's company website (optional, must be an http/https URL if given); phone = 10 digits; degree is chosen from `DEGREE_OPTIONS` (the degree values used in job eligibility); graduation year from the current year −2 to +2; CGPA 0–10. Registration does not log the user in: they are sent to the login page with their email pre-filled and a one-time success message (`fh_flash`).

### 4.2 Jobs
- **BR-07** Only recruiters with status `active` can post jobs.
- **BR-08** A newly posted job has status `pending`. Only `approved` jobs are visible to students and on the landing page.
- **BR-09** Admin may set `pending` → `approved` or `rejected` (rejection requires a reason).
- **BR-10** A recruiter may close their own `approved` job (`closed`). Closed jobs are hidden from job search but remain visible in existing applications.
- **BR-11** Editing an `approved` job's core fields (title, description, eligibility, salary) returns it to `pending`.
- **BR-12** A job whose deadline has passed is treated as **expired** (computed from `deadline`, not stored): shown with an "Expired" badge and cannot be applied to.

### 4.3 Applications
- **BR-13** A student may apply only once per job (a withdrawn application still counts; no re-apply).
- **BR-14** Apply is allowed only if the job is `approved`, not expired, and the student meets eligibility:
  - student's `graduationYear` is in the job's `eligibility.graduationYears` (if the list is non-empty),
  - student's `degree` is in the job's `eligibility.degrees` (if the list is non-empty),
  - student's `cgpa` ≥ `eligibility.minCgpa` (if set).
- **BR-15** Application status flow:
  ```
  applied → under_review → shortlisted → interview → selected
      \            \              \            \
       └────────────┴──────────────┴────────────┴──→ rejected   (by recruiter)
  applied / under_review ──→ withdrawn                          (by student)
  ```
  `selected`, `rejected`, and `withdrawn` are final.
- **BR-16** Every status change is appended to the application's `statusHistory` with a timestamp.
- **BR-17** If a student has a resume at the time of applying, a reference to it is recorded on the application. A resume is **not** required to apply.

### 4.4 Saved Jobs
- **BR-18** A student can save any approved job once; saving again toggles it off.

### 4.5 Notifications (Phase 10)
Notifications are created by the server, inside the operation that causes them, for these events:
| Event | Recipient |
|---|---|
| Student applies to a job | Recruiter who owns the job |
| Application status changes | Student |
| Job approved / rejected | Recruiter |
| Recruiter account approved | Recruiter |
| Admin announcement | Selected audience |

### 4.6 Demo Data
- **BR-19** Demo data from `/data/*.json` is imported into the database by the seed script (`npm run seed`), run on purpose. It only adds missing records, never changes or deletes existing ones, and stores passwords as bcrypt hashes. The server never seeds by itself.
- **BR-20** Admin "Reset demo data" deletes everything except admin accounts and imports the demo data again — only on a server that allows it (`ALLOW_DEMO_RESET=true`).

## 5. Data Models

The shapes below are what the API sends and receives (MongoDB collections: `users`, `jobs`, `applications`,
`savedjobs`, `notifications`, `resumes` — see ARCHITECTURE.md §4). IDs are MongoDB ObjectIds written as
24-character strings (the `usr_…` / `job_…` ids appear only in the seed files, where they link records to each
other; the seed script maps them to ObjectIds). Dates are ISO 8601 strings.

### 5.1 User
The password is stored only as a bcrypt hash and is never part of any API response.
```json
{
  "id": "…",
  "role": "student | recruiter | admin",
  "name": "Rishita Kadam",
  "email": "rishu@example.com",
  "phone": "9876543210",
  "status": "active | pending | blocked",
  "createdAt": "2026-09-01T10:00:00.000Z",
  "profile": { }
}
```

**Student `profile`:**
```json
{
  "college": "ABC College of Engineering",
  "degree": "B.E.",
  "branch": "Computer Engineering",
  "graduationYear": 2026,
  "cgpa": 8.2,
  "location": "Pune",
  "about": "",
  "skills": ["HTML", "CSS", "JavaScript"],
  "education": [{ "level": "HSC", "institute": "", "year": 2022, "score": "85%" }],
  "projects": [{ "title": "", "description": "", "link": "" }],
  "links": { "linkedin": "", "github": "", "portfolio": "" },
  "resume": { "fileName": "resume.pdf", "sizeBytes": 123456, "uploadedAt": "" }
}
```
`resume` is `null` when not uploaded; the file itself is fetched separately. A student's own user object also
carries `completeness` `{ percent, missing[] }`, calculated by the server. Registration collects `college`, `degree`, `branch`, `graduationYear`, `cgpa`; the rest is filled in Phase 7.

**Recruiter `profile`:**
```json
{
  "companyName": "TechNova Pvt Ltd",
  "designation": "HR Manager",
  "companyWebsite": "https://example.com",
  "companyLocation": "Bengaluru",
  "companySize": "51-200",
  "industry": "IT Services",
  "about": ""
}
```

**Admin `profile`:** `{}`

### 5.2 Job
```json
{
  "id": "…",
  "recruiterId": "…",
  "title": "Junior Frontend Developer",
  "companyName": "TechNova Pvt Ltd",
  "location": "Pune",
  "jobType": "full-time | internship | part-time",
  "workMode": "on-site | remote | hybrid",
  "salaryMin": 300000,
  "salaryMax": 450000,
  "salaryPeriod": "year | month",
  "experience": "0-1 years",
  "skills": ["HTML", "CSS", "JavaScript"],
  "description": "",
  "responsibilities": [""],
  "eligibility": { "degrees": ["B.E.", "B.Tech"], "graduationYears": [2025, 2026], "minCgpa": 7.0 },
  "openings": 3,
  "deadline": "2026-10-31",
  "status": "pending | approved | rejected | closed",
  "rejectionReason": "",
  "postedAt": "",
  "updatedAt": ""
}
```
Internships use `salaryPeriod: "month"` (stipend). Amounts are in INR. Every job in a response also has
`isExpired` (computed from the deadline for that request, never stored); students never receive `rejectionReason`.

### 5.3 Application
The recruiter is not stored on the application: it is always the owner of the job.
```json
{
  "id": "…",
  "jobId": "…",
  "studentId": "…",
  "coverNote": "",
  "resumeFileName": "resume.pdf",
  "status": "applied | under_review | shortlisted | interview | selected | rejected | withdrawn",
  "statusHistory": [{ "status": "applied", "at": "", "note": "" }],
  "appliedAt": "",
  "updatedAt": ""
}
```
`resumeFileName` is `null` if the student had no resume when applying.

### 5.4 Saved Job
```json
{ "jobId": "…", "savedAt": "" }
```
Stored as a student ↔ job link (unique per pair); the student is always the logged-in user.

### 5.5 Notification
```json
{
  "id": "…",
  "userId": "…",
  "type": "application | status | job | account | announcement",
  "title": "Application shortlisted",
  "message": "",
  "link": "pages/student/applications.html",
  "read": false,
  "createdAt": ""
}
```
`link` is relative to the project root. Announcements create one notification per recipient.

### 5.6 Session (`fh_session` in `sessionStorage`)
```json
{ "token": "<signed login token>", "userId": "…", "role": "student", "name": "Rishita Kadam", "loginAt": "" }
```
Only `token` matters to the server; the other fields are hints for the interface.

## 6. Demo Credentials (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | admin@freshhire.com | Admin@123 — local databases only; a deployed database gets a private admin password when it is seeded (DEPLOYMENT.md §2) |
| Student | student@freshhire.com | Student@123 |
| Recruiter | recruiter@freshhire.com | Recruiter@123 |

Seed data also includes additional students, recruiters (one `pending`, one `blocked`), ~20 jobs across all statuses, sample applications, and sample notifications.

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Platform | Latest Chrome, Edge, Firefox (desktop and mobile) |
| Serving | Frontend: any static host (ES modules do not work on `file://`). API: Node.js. Database: MongoDB. Target: Netlify + Render + MongoDB Atlas free tiers |
| Responsiveness | Usable from 360px width upward |
| Accessibility | Semantic HTML, labelled form fields, keyboard navigation, visible focus, WCAG AA contrast |
| Performance | Each page interactive quickly on a normal laptop; lists are paged on the server; no third-party downloads. On free hosting the first request after an idle period can take up to about a minute |
| Storage | MongoDB (free tier: 512 MB); resumes are capped at 500 KB each |
| Security | Hashed passwords, server-side role and ownership checks, input validation, rate-limited login, restricted CORS — details and remaining risks in docs/SECURITY.md |
| Offline | Not supported: the pages need the API (no CDNs or other external services are used) |

## 8. Known Limitations (to be stated in viva)
- Not production-secure: no email verification, password reset, account lockout or two-factor login.
- The login token is in `sessionStorage`, readable by any script on the page (see docs/SECURITY.md).
- The demo student and recruiter accounts have public passwords.
- The login session is per browser tab; closing the tab logs the user out; tokens last 2 hours.
- No email, SMS or real-time notifications.
- Free hosting: slow first request after idle, small database, no backups.

## 9. Final Implementation Status (Phase 14 review)

Every feature listed in §3 is implemented as described (Phases 1–12) and, since Phase 15, runs against the API
and the database. Decisions recorded during development that refine this specification:

- **Pending recruiters** can log in, see an approval banner and edit their company profile; posting, editing and
  closing jobs and viewing applicants are refused by the services until an admin approves them (§3.3).
- **Withdraw** was delivered with application tracking in Phase 6 (it is listed there in §3.2).
- **No recruiter delete** of jobs (only close); deleting jobs is an admin action (§3.3, §3.4).
- **No admin application management**: the admin sees application totals and reports, not individual
  applications (§3.4 does not list it).
- **Notifications** are created only for the five events in §4.5 (not for withdrawals, job closing or blocking).
- **Analytics** (§3.2–3.4) have no filters; "applications over time" is grouped by week up to 16 weeks, then by
  month. Each report exports its own CSV file.
- **Charts** are hand-written inline SVG; every chart has text values or a table.
- **Responsiveness** is supported from 360px (§7); below that width the layout is not guaranteed.

Not built (never specified as features): email / SMS, password reset, file types other than PDF for resumes,
interview scheduling. See §1.2 and §8.
