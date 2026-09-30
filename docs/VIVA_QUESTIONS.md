# FreshHire — Viva Questions and Answers

Short answers meant to be spoken. Where it matters, answers separate **the current project** from **what a
production system would do**.

---

## Project basics

**1. What is FreshHire?**
A job portal for freshers with three roles. Students search and apply for jobs, recruiters post jobs and review
applicants, and an admin approves recruiters and jobs. It runs entirely in the browser.

**2. Why did you build it?**
To build a complete multi-role application — login, roles, search, applications, moderation, notifications and
reports — and to understand how such a system is structured, using only core web technologies.

**3. What problem does it solve?**
Freshers waste time on jobs they are not eligible for and lose track of applications. FreshHire checks
eligibility before applying, shows each application's status timeline, and gives recruiters a clear status flow.

**4. Who are the users?**
Students (freshers), recruiters, and one admin. Students and recruiters register themselves; the admin account
comes from the seed data.

**5. What are the major modules?**
Public pages (landing, login, register), student portal, recruiter portal, admin portal, notifications, and
analytics / reports. Underneath: the core (config, storage, auth, seed, utils) and eight services.

## Technology

**6. Why HTML, CSS and JavaScript?**
They are the foundation of every web app, run in any browser without installation, and let me show that I
understand what frameworks do for you.

**7. Why Vanilla JavaScript instead of a framework?**
No hidden behaviour: I wrote the routing guards, rendering, state and components myself, so I can explain every
line. ES modules give enough structure without a build step.

**8. Why localStorage?**
It keeps data in the browser between visits, so jobs, applications and profiles survive a page reload without a
server. It is the project's stand-in for a database.

**9. Why sessionStorage?**
For the login session. It is per tab and cleared when the tab closes, which behaves like a real session — closing
the tab logs you out.

**10. Why JSON mock data?**
It provides realistic starting data (11 users, 20 jobs, 15 applications, 9 notifications). It is loaded once into
`localStorage`, and the admin can reset to it.

**11. Why no backend?**
It was a project requirement: a frontend-only simulation. It keeps the project runnable anywhere with only a
static file server.

**12. Why frontend-only — isn't that a weakness?**
For security, yes, and I state that clearly. But the architecture separates rules into services, so the same
design could move to a server later.

## Architecture

**13. Explain the architecture.**
HTML page → page script → components (UI pieces) and services (business rules) → core modules → browser storage.
Pages never touch storage; services never touch the DOM; only `storage.js` reads or writes storage.

**14. What is the role of services?**
They hold every business rule: eligibility, the status flow, ownership, validation and approvals. Pages only call
them and show the result, so each rule exists in exactly one place.

**15. Why a storage abstraction?**
One module handles JSON parsing, errors and "storage full". All keys come from `config.js` with the `fh_` prefix.
If storage changed (for example to an API), only this layer and the services would change.

**16. How does authentication work?**
Login finds the account by email, compares the password, refuses blocked accounts and writes a session
(`userId`, `role`, `name`, `loginAt`) to `sessionStorage`. `getCurrentUser()` re-reads the account every time,
so blocked or deleted users are logged out on the next page.

**17. How does authorization work?**
On two levels. Every protected page runs a role guard before it is shown (no session → login; wrong role → own
dashboard). Every service operation also re-checks the logged-in user's role and ownership.

**18. How are roles separated?**
Pages are in role folders (`pages/student/`, `pages/recruiter/`, `pages/admin/`, plus `pages/shared/`
notifications). The guard allows only the matching role, and the sidebar menu is built per role.

## Student

**19. How does a student apply?**
On Job Details they select *Apply now*, add an optional cover note and submit. The service re-checks that the job
is approved and not expired, that they are eligible (degree, graduation year, CGPA), and that they haven't
applied before. It then saves the application with the first history entry and notifies the recruiter.

**20. How do saved jobs work?**
A save stores `{ studentId, jobId, savedAt }`. The button toggles between *♡ Save* and *♥ Saved*. The Saved Jobs
page lists them newest first and still shows jobs that were closed or removed, so the student can remove them.

**21. How does application tracking work?**
Each application keeps a `statusHistory` list. Every change is appended with a timestamp, never rewritten. My
Applications shows the current status, a filter by status and a timeline.

**22. How does withdrawal work?**
Only while the status is *Applied* or *Under Review*, and only after confirmation. It appends "Withdrawn by
student." to the history. A withdrawn application still counts, so the student cannot apply again.

**23. How is profile completeness calculated?**
There are 15 equally weighted items: name, email, phone, college, degree, branch, graduation year, CGPA,
location, about, at least one skill, one education entry, one project, any profile link, and a resume. The
percentage is the number completed out of 15.

**24. How is resume data handled?**
Only PDFs up to 500 KB are accepted. The file is stored as Base64 in the student's profile, and viewing or
downloading uses a temporary `blob:` URL. The application records the resume's file name at the time of
applying. Students can also print a resume generated from their profile.

## Recruiter

**25. How does recruiter approval work?**
New recruiters are `pending`. They can log in and edit their company profile, but posting jobs and seeing
applicants are blocked in the services, not just hidden. When the admin approves them they become `active` and
get a notification.

**26. How does job creation work?**
The recruiter fills the form, previews it, and submits. The service validates every field and takes the
recruiter and company from the session. The job is saved as `pending`.

**27. How does job approval work?**
The admin sees pending jobs and can approve them, or reject them with a reason. Only `pending` jobs can be
decided. Approved jobs appear to students at once, and the recruiter is notified either way. Editing an approved
job's title, description, eligibility or pay sends it back to `pending`.

**28. How are applicants managed?**
The Applicants page lists the job's applicants with their status. *View profile* shows contact details, cover
note, status history, profile and resume.

**29. How do status updates work?**
The dropdown offers only the allowed next steps: one step forward (Applied → Under Review → Shortlisted →
Interview → Selected) or Rejected. Selected and Rejected need confirmation and are final. Each change is appended
to the history and notifies the student.

**30. How is recruiter ownership enforced?**
Ownership is checked in the service: an application belongs to the recruiter of its job (`application.jobId →
job.recruiterId`). Another recruiter's job or application simply returns "not found". URL parameters and the
copied `recruiterId` field are never trusted.

## Admin

**31. What can the admin do?**
See platform totals; approve recruiters; block, unblock or delete users; approve, reject or delete jobs; send
announcements; view reports and export CSV; reset the demo data.

**32. How does recruiter approval work for the admin?**
Users page → filter to pending recruiters → *Approve*. The account becomes `active` and the recruiter is
notified. Alternatively the admin can delete the request.

**33. How does job approval work for the admin?**
Moderate Jobs → filter *Pending* → *View* to read the job → *Approve*, or *Reject* with a reason of 1–300
characters.

**34. How is admin access protected?**
The admin pages' guard allows only the admin role. Every admin service function re-checks that the session user
is an admin. Admin accounts cannot be registered, blocked or deleted. (All of this runs client-side — see Q41.)

## Notifications

**35. How are notifications stored?**
As records in `fh_notifications` with `userId`, `type`, `title`, `message`, `link`, `read` and `createdAt`. They
are created by the services right after an action is saved, for five events.

**36. How is unread state handled?**
Each record has `read: false` until the user opens it or selects *Mark as read* / *Mark all as read*. The bell
shows the count of the user's unread notifications.

**37. How do you stop users seeing others' notifications?**
Every query filters by the session user's id. Marking as read checks that the notification belongs to that
user. Links are followed only to pages of the user's own role or shared pages.

## Analytics

**38. How are analytics calculated?**
On demand, from the stored records — nothing is stored separately. The service counts records per category,
works out whole-number percentages (0 when the total is 0), and groups applications by week or month.

**39. How are recruiter analytics isolated?**
They use the same ownership rule: only the recruiter's own jobs, and only the applications to those jobs. This
was tested with two recruiters in both directions.

**40. How are charts generated?**
With my own small component (`charts.js`) that builds inline SVG — bars, a donut and a line — with no chart
library. Every chart has text values or a table next to it, so the information is not only visual.

## Security

**41. Is localStorage secure?**
No. Anyone using the browser can read and change it with DevTools, and the demo passwords are in plain text. The
project states this openly; it is a simulation.

**42. What are the security limitations?**
There is no server enforcing rules, no password hashing, and data can be edited by hand. The role checks run on
the same machine they are protecting.

**43. Why is frontend-only authentication not secure?**
Because the user controls the browser. They can change their role in storage or call functions from the console.
Real security needs checks on a server the user cannot modify.

**44. How would you secure it in production?**
Move the services behind an API. Use a database, hash passwords (bcrypt / Argon2), and use server sessions or
signed tokens over HTTPS. Check the role and ownership on every request on the server, and store resumes in
protected file storage.

## Testing

**45. How did you test the project?**
With browser test pages that open the real pages in an iframe and check results. There are 19 suites and 1,254
checks, run headless in Edge and Firefox (and Chrome before the last fixes). I also ran a layout audit at eight
widths, Lighthouse accessibility audits, real keyboard tests and mobile device emulation.

**46. What types of testing did you do?**
Functional tests per feature, role and ownership tests, end-to-end journeys with page reloads, edge cases (empty,
corrupted and full storage, invalid URLs, long text), regression after every phase, responsive checks,
accessibility checks and cross-browser runs.

**47. How did you test responsive design?**
Every page for every role was rendered at 360, 375, 390, 414, 768, 1024, 1280 and 1440px — 240 renders in
total. Each was checked for sideways scrolling, clipped text, small tap targets and heading order. I also emulated
real phones with touch input.

**48. How did you test role isolation?**
By opening every protected page directly by URL as a logged-out user, a student, a recruiter, a pending recruiter
and the admin, and checking each redirect. I also called the services with the wrong role and checked they
refused.

**49. How did you test ownership?**
With two students and two recruiters: each should see only their own data. I also tried another user's ids in
URLs and forged fields like `recruiterId`, and checked that nothing changed.

## General

**50. What was the most challenging part?**
Keeping rules consistent across roles — especially ownership and the application status flow. Also making tables
and charts work on a 360px phone and fully by keyboard.

**51. What would you improve?**
Add a real backend and database, and keep the automated tests in the repository with a simple runner.

**52. What would you add in the future?**
Email notifications, real-time updates, verified recruiter onboarding, richer search and recommendations, and
interview scheduling.

**53. What did you learn?**
How to structure an application in layers, why business rules belong in one place, and how much work
accessibility and responsive design really take. Also why security must live on a server.

---

## Hard / counter questions

**Why localStorage instead of a database?**
*Current project:* the brief was frontend-only, so `localStorage` acts as the data store and all access goes
through one storage module. *Production:* a real database (for example PostgreSQL) behind an API, with
transactions, backups and access control.

**What happens if a user edits localStorage manually?**
*Current project:* they can change anything, including making themselves admin. Damaged or invalid data is
detected and the app re-seeds instead of crashing, but there is no protection. *Production:* the data lives on a
server the user cannot edit, and every request is checked there.

**Can your authentication be considered secure?**
No. It demonstrates the flow — login, sessions, guards, blocked accounts — but passwords are plain text and all
checks run in the browser.

**How would you implement real authentication?**
Registration stores a bcrypt / Argon2 hash. Login is checked by the server, which issues an HttpOnly, Secure
session cookie or a short-lived signed token. Add logout, expiry, rate limiting and password reset by email.

**How would you prevent unauthorized API access?**
Authenticate every request, then check the role and ownership on the server — for example "this application's
job belongs to this recruiter" — before reading or writing. My service functions already express these rules;
they would move to the server.

**Why not Angular or React?**
The project rules excluded frameworks, and vanilla JS let me show the fundamentals. For a larger team or product,
a framework would help with components and state. The layered design would still apply.

**How would you scale it?**
Put a stateless API behind a load balancer with a database. Add indexes on common queries (jobs by status,
applications by job), pagination on the server, caching for public job lists, and file storage on a CDN.

**How would you handle many students applying at the same time?**
In the database: each application is its own row, created inside a transaction. Counts are computed with queries
rather than read-modify-write of one big list (which is what `localStorage` forces today).

**How would you prevent duplicate applications on a real backend?**
Add a unique constraint on (student, job) in the database, as well as the check in the service. The constraint
makes duplicates impossible even if two requests arrive together.

**How would you store resumes securely?**
In object storage (for example S3) with private access. Validate type and size on the server, scan for
viruses, and serve files through short-lived signed links only to the student and to recruiters of jobs they
applied to.

**How would you verify recruiters?**
Verify the email with a link, check the company domain or registration documents, and keep a manual admin
review — today's `pending` → `active` flow — with an audit trail.

**How would you do real-time notifications?**
Server-sent events or WebSockets push new notifications to open pages, plus email for important events. The
notification records would stay in the database, as they are today.

**What would change if you added a backend?**
Storage calls become API calls; services split into client code (validation for quick feedback) and server code
(the real enforcement); seed data becomes database migrations; the session becomes a server session.

**What would you keep?**
The page and component structure, the design system, the business rules as written in the services, the
ownership model, the accessibility and responsive work, and the tests' scenarios.
