# PROJECT_SPEC.md — FreshHire Functional Specification

## 1. Overview

**FreshHire** is a simulated job portal that helps **freshers** (final-year students and recent graduates) discover entry-level jobs and internships, apply to them, and track their applications. Recruiters post jobs and manage applicants; an Admin moderates users and jobs.

> **FreshHire is a FRONTEND-ONLY project.** It is built with HTML5, CSS3, and Vanilla JavaScript (ES6+).
> All data is mock data loaded from JSON files on first run and then stored in the browser's `localStorage`.
> The login session is stored in `sessionStorage`. There is no backend, database, or API server.

### 1.1 Objectives
1. Demonstrate a complete, multi-role web application using only client-side technologies.
2. Provide a clean, responsive, accessible UI.
3. Simulate real portal workflows: registration, login, job search, applications, moderation, notifications, analytics.

### 1.2 Out of Scope
- Real authentication, encryption, or security
- Real email/SMS delivery
- Multi-device or multi-user data sharing (data is per-browser)
- Payments, chat, video interviews
- Any server, database, or third-party API

## 2. Roles

| Role | How the account is created | Initial status | Can log in? |
|---|---|---|---|
| Student | Self-registration | `active` | Yes |
| Recruiter | Self-registration | `pending` (until Admin approves) | Yes, with limited access while `pending` |
| Admin | Seed data only (cannot register) | `active` | Yes |

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

*Dashboard definitions (Phase 3):* **Applications** = all of the student's applications (any status); **Shortlisted** = applications currently in status `shortlisted`; **Saved jobs** = the student's `fh_saved_jobs` records; **Profile completeness** = share of 15 equally weighted items (name, email, phone, college, degree, branch, graduation year, CGPA, location, about, ≥1 skill, ≥1 education entry, ≥1 project, any profile link, resume). **Recommended jobs** = approved, non-expired jobs not yet applied to, ranked by number of matching skills then newest. All figures use only the logged-in student's own records.
| Browse approved jobs; keyword search; filters (location, job type, work mode, salary/stipend range, skills); sort (newest, deadline, salary); pagination | 4 |

*Job search rules (Phase 4):* **Search** covers title, company and skills; case-insensitive; extra spaces ignored; every typed word must appear. **Filters** combine with AND. **Location** is an exact (case-insensitive) match from the list of locations in the data. **Salary / stipend** ranges (`PAY_RANGES` in config.js) each belong to one pay period (monthly stipend or yearly salary); a job matches when its pay range overlaps the chosen range; undisclosed pay never matches a range. **Skills**: a job must list every selected skill. **Sort**: newest (default), deadline (soonest first), salary (highest first; monthly amounts ×12 for comparison; undisclosed last). 9 jobs per page; any search/filter/sort change returns to page 1. Expired jobs hidden unless "Show expired" is ticked (BR-12). The last used search/filters/sort/page are kept for the tab in `fh_job_filters` (sessionStorage).
| Job details page with eligibility check | 5 |
| Apply with an optional cover note (≤ 1,000 characters; resume reference attached automatically if on the profile) | 5 |
| Withdraw an application | 6 |
| Save / unsave jobs; Saved Jobs page | 6 |
| My Applications page with status timeline and status filter | 6 |

*Saved jobs & tracking rules (Phase 6):* only approved jobs (expired included) can be saved; unsaving always works, including for jobs that were later closed or removed; saved links are never deleted automatically. Withdrawing needs a confirmation and is allowed only from `applied` / `under_review` (BR-15); it appends a history entry "Withdrawn by student." (BR-16) and still blocks re-applying (BR-13). Applications are historical records: they stay listed when their job expires, closes or disappears. The student for every save, unsave and withdraw is taken from the session.
| Profile: personal, education, skills, projects, links; profile completeness % | 7 |
| Resume: upload PDF (≤ 500 KB, stored as Base64) **or** build a simple resume from profile data and print it | 7 |

*Profile rules (Phase 7):* the student edits only their own profile (taken from the session). Each tab saves its own section; `id`, `role`, `email` (login ID, shown read-only), `password`, `status` and `createdAt` can never change here. **Personal:** name (required, ≤ 100), phone (required, 10 digits — same rules as registration), location (≤ 100), about (≤ 1,000). **Education:** college, degree, branch, graduation year and CGPA with the registration rules (+ ≤ 100 characters for text); up to 5 extra entries, each with level (required, ≤ 50), institute (required, ≤ 100), year of passing (required, 1980 to current year + 5) and score (optional, ≤ 20). **Skills:** up to 30, each 1–40 characters, no duplicates ignoring letter case; added/removed in the list and stored when the student selects Save. **Projects & links:** up to 5 projects (title required ≤ 100, description ≤ 500, optional link); LinkedIn, GitHub, portfolio and project links are optional but must be `http://` or `https://` URLs (so `javascript:` and similar can never be stored); links are shown as text, not clickable. **Resume:** PDF only (`application/pdf`), 1 byte to 500 KB, stored as `profile.resume` `{ fileName, dataUrl, uploadedAt }`; a failed upload (invalid file or full storage) keeps the previous resume; removing asks for confirmation; viewing/downloading uses a temporary in-browser `blob:` URL of the student's own file. Applications keep the `resumeFileName` recorded when they were sent (BR-17), so replacing or removing a resume never changes them. The printable resume is generated from the saved profile; printing the Profile page prints only that resume (A4).
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

### 3.4 Admin
| Feature | Phase |
|---|---|
| Dashboard: platform totals (students, recruiters, jobs by status, applications) | 9 |
| Manage users: search, filter by role/status, approve recruiters, block/unblock, delete | 9 |
| Moderate jobs: approve / reject (with reason) / delete | 9 |
| Reset demo data to seed state (with confirmation) | 9 |
| Send announcements (to all users, all students, or all recruiters) | 10 |
| Reports page: charts and tables; export a report as CSV (client-side download) | 11 |

## 4. Business Rules

### 4.1 Accounts & Authentication
- **BR-01** Email must be unique (case-insensitive) across all users.
- **BR-02** Password: minimum 8 characters, at least one uppercase letter, one lowercase letter, and one digit.
- **BR-03** Login checks email + password against `fh_users`. `blocked` users are refused with a clear message.
- **BR-04** On successful login, a session object is written to `sessionStorage` (`fh_session`). Closing the tab ends the session.
- **BR-05** Every protected page runs a role guard: no session → redirect to login; wrong role → redirect to that user's own dashboard.
- **BR-06** Admin accounts cannot be created through registration.

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
Notifications are created in `localStorage` for these events:
| Event | Recipient |
|---|---|
| Student applies to a job | Recruiter who owns the job |
| Application status changes | Student |
| Job approved / rejected | Recruiter |
| Recruiter account approved | Recruiter |
| Admin announcement | Selected audience |

### 4.6 Demo Data
- **BR-19** On first load (or when `DATA_VERSION` changes), seed data from `/data/*.json` is copied into `localStorage`.
- **BR-20** Admin "Reset demo data" clears all `fh_` keys and re-seeds.

## 5. Data Models

All IDs are strings: a prefix + base-36 timestamp + random suffix (e.g. `job_lx2k9a_4f7`). Dates are ISO 8601 strings.

### 5.1 User (`fh_users` → array)
```json
{
  "id": "usr_...",
  "role": "student | recruiter | admin",
  "name": "Asha Patil",
  "email": "asha@example.com",
  "password": "Student@123",
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
  "resume": { "fileName": "resume.pdf", "dataUrl": "data:application/pdf;base64,...", "uploadedAt": "" }
}
```
`resume` is `null` when not uploaded. Registration collects `college`, `degree`, `branch`, `graduationYear`, `cgpa`; the rest is filled in Phase 7.

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

### 5.2 Job (`fh_jobs` → array)
```json
{
  "id": "job_...",
  "recruiterId": "usr_...",
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
Internships use `salaryPeriod: "month"` (stipend). Amounts are in INR.

### 5.3 Application (`fh_applications` → array)
```json
{
  "id": "app_...",
  "jobId": "job_...",
  "studentId": "usr_...",
  "recruiterId": "usr_...",
  "coverNote": "",
  "resumeFileName": "resume.pdf",
  "status": "applied | under_review | shortlisted | interview | selected | rejected | withdrawn",
  "statusHistory": [{ "status": "applied", "at": "", "note": "" }],
  "appliedAt": "",
  "updatedAt": ""
}
```
`resumeFileName` is `null` if the student had no resume when applying.

### 5.4 Saved Job (`fh_saved_jobs` → array)
```json
{ "studentId": "usr_...", "jobId": "job_...", "savedAt": "" }
```

### 5.5 Notification (`fh_notifications` → array)
```json
{
  "id": "ntf_...",
  "userId": "usr_...",
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
{ "userId": "usr_...", "role": "student", "name": "Asha Patil", "loginAt": "" }
```

## 6. Demo Credentials (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | admin@freshhire.com | Admin@123 |
| Student | student@freshhire.com | Student@123 |
| Recruiter | recruiter@freshhire.com | Recruiter@123 |

Seed data also includes additional students, recruiters (one `pending`, one `blocked`), ~20 jobs across all statuses, sample applications, and sample notifications.

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Platform | Latest Chrome, Edge, Firefox (desktop and mobile) |
| Serving | Must be served by a static file server (ES modules and `fetch()` of JSON do not work on `file://`) |
| Responsiveness | Usable from 360px width upward |
| Accessibility | Semantic HTML, labelled form fields, keyboard navigation, visible focus, WCAG AA contrast |
| Performance | Each page interactive quickly on a normal laptop; no external downloads |
| Storage | Stay well under the ~5 MB `localStorage` limit (hence the 500 KB resume cap) |
| Offline | Works without internet once served locally (no CDNs) |

## 8. Known Limitations (to be stated in viva)
- Plain-text passwords in `localStorage` — simulation only.
- Data is not shared between browsers/devices.
- Any user can inspect/modify data via DevTools.
- The `localStorage` quota limits resume uploads.
