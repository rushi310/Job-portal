# FreshHire — Security Model (Frontend-Only)

> **Important:** FreshHire has **no backend**. Every rule below runs in JavaScript **inside the user's own
> browser**, and all data sits in that browser's `localStorage`. This is a **simulation of an access-control
> design, not production-grade security.** A user who opens the browser's DevTools can read or change any stored
> data, including passwords, and can bypass every check. Do not use FreshHire with real personal data.

What the project *does* do is apply the rules consistently, in one place, so the behaviour is correct for normal
use and the design could later be moved to a real server.

## 1. Authentication (simulated)

- **Accounts** are stored in `fh_users` (`localStorage`). Passwords are stored **in plain text** — for
  demonstration only. They are never shown in the UI or returned by services to pages (the admin users list and
  the recruiter's candidate view strip them).
- **Login** (`core/auth.js`) looks the account up by email (case-insensitive), compares the password, refuses
  `blocked` accounts, and writes a session `{ userId, role, name, loginAt }` to `sessionStorage` (`fh_session`).
  The session holds no password and ends when the tab is closed.
- **Registration** creates only `student` (status `active`) or `recruiter` (status `pending`) accounts; `admin`
  cannot be registered (BR-06). Email must be unique; the password needs 8+ characters with upper-case,
  lower-case and a digit (BR-01, BR-02).
- **Every request for "who is acting"** goes back to storage: `getCurrentUser()` re-reads the account behind the
  session, so a user who has been blocked or deleted is logged out on the next page load.

## 2. Authorization

### Page guards
Every protected page starts through `components/app-shell.js` → `auth.requireRole(...)`:

| Situation | Result |
|---|---|
| No session | Sent to the login page with a `returnTo` of the requested page |
| Logged in with another role | Sent to their own dashboard with a warning |
| Account deleted or blocked | Session removed, sent to the login page |
| Right role | Page is shown (the page is hidden until the check passes) |

`returnTo` is accepted only for project pages in the user's own role folder or `pages/shared/`, so a crafted link
cannot redirect to another site or another role's page. Hidden menu items are **not** relied on: every page is
guarded when opened directly by URL.

### Service-level checks
Services do not trust the page. Each write operation takes the acting user from the session and re-checks it:

| Area | Rule |
|---|---|
| Student data | Applications, saved jobs, profile and resume are read and written only for the logged-in student. |
| Applying | Job must be approved, not expired, the student eligible and not already applied (BR-13, BR-14). |
| Recruiter approval | Recruiters with status `pending` cannot post, edit or close jobs or see applicants (BR-07). |
| Job ownership | A recruiter can edit / close only jobs where `job.recruiterId` is their id; another recruiter's job looks like "Job not found". |
| Application ownership | A recruiter can see or change an application only if its job is theirs (`application.jobId → job.recruiterId`); the copied `application.recruiterId` field is not trusted. |
| Status flow | Recruiters can only move an application one step forward or reject it; *Selected*, *Rejected* and *Withdrawn* are final (BR-15, BR-16). |
| Job approval | Only the admin can approve or reject jobs, only from `pending` (BR-09); a recruiter cannot approve their own job. |
| Admin actions | Every admin service re-checks the admin role; admin accounts (including the admin's own) cannot be blocked or deleted. |
| Notifications | Each user sees and marks read only notifications with their own `userId`; links are followed only to pages of the user's own role or shared pages. |
| Analytics | Students get only their own counts, recruiters only their own jobs and applicants, the admin the platform report. |
| Injected fields | Form values such as `id`, `role`, `status`, `recruiterId` or `password` sent to a service are ignored (whitelists). |

## 3. Safe handling of data in the page

- User-entered text is inserted with `textContent` (never as HTML), so names or job titles containing HTML are
  shown as text, not executed.
- Links entered by users (profile links, company website) must start with `http://` or `https://`, so
  `javascript:` links cannot be stored.
- Resume uploads must be `application/pdf` and at most 500 KB; they are opened through a temporary `blob:` URL.
- CSV exports prefix cells that start with `=`, `+`, `-` or `@` so a spreadsheet does not treat them as formulas.

## 4. Storage

- All keys use the `fh_` prefix and are defined once in `core/config.js`; only `core/storage.js` reads or writes
  browser storage.
- Unreadable or damaged data is caught; the app re-seeds from the JSON files instead of crashing.
- A full `localStorage` (quota exceeded) produces a friendly message and leaves the previous data unchanged.
- Data is **per browser**: it is never sent anywhere, and it is not shared between users of different browsers.

## 5. Limitations (why this is not secure)

1. Anyone with access to the browser can read `fh_users`, including plain-text passwords.
2. Anyone can edit `localStorage` (e.g. change their role to `admin`) or call the services from the console; the
   checks run on the same machine they are meant to protect.
3. There is no server to enforce rules, no password hashing, no rate limiting, no HTTPS requirement, no audit log.
4. Resumes are stored as Base64 inside `localStorage`, readable by anyone with DevTools.

## 6. What a production version would need

- A server-side API that enforces every rule above on each request (the service layer is the natural blueprint).
- A database with per-user access control instead of `localStorage`.
- Passwords hashed with a slow algorithm (e.g. bcrypt / Argon2), never stored or sent in plain text.
- Server sessions or short-lived signed tokens over HTTPS, with logout and expiry.
- File storage for resumes with access checks, virus scanning and signed download links.
- Rate limiting, input validation on the server, security headers (CSP), audit logging and monitoring.
