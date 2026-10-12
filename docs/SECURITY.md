# FreshHire — Security

FreshHire is a college project. Since Phase 15 it has real authentication, server-side permissions
and a real database, and this page lists what that protects. It is **not** a claim that the
application is production-secure: the second half lists what is missing, and nobody has audited or
penetration-tested it. Do not store real personal data in it.

(The earlier frontend-only version had no security at all — data and plain-text demo passwords lived
in the browser. That description no longer applies.)

## 1. What is protected, and how

| Area | Measure | Where |
|---|---|---|
| Passwords | Stored only as bcrypt hashes (cost 10). Never returned by the API (`select: false` on the field, and every response goes through serializers). Rule: 8–128 characters with upper-case, lower-case and a digit. | `models/user.js`, `services/auth-service.js`, `utils/serializers.js` |
| Login | Same answer and similar timing for an unknown email and a wrong password. Blocked accounts are refused. | `auth-service.login` |
| Sessions | Signed token (JWT, HS256), valid 2 hours. On every request the user is loaded from the database; the token is refused if the user was deleted or blocked, the role changed, or the user logged out since (token version). | `middleware/auth.js` |
| Roles | Each group of routes requires its role on the server. A role or user id sent by the browser is ignored. Admin accounts cannot be registered — only the seed script creates one. | `routes/index.js`, `auth-service.register` |
| Recruiter approval | Posting, editing and closing jobs and everything about applicants need an `active` recruiter. Approval takes effect on the recruiter's next request. | `requireActiveRecruiter` |
| Ownership | Queries always include the authenticated user's id: own profile, own applications, own saved jobs, own notifications, own jobs, applications to own jobs. Someone else's record answers 404, like a missing one. | services |
| State rules | Approve / reject only pending jobs; recruiters cannot approve; status steps follow the allowed flow; withdraw only from the first two statuses. Changes are conditional database updates, so two requests at once cannot both succeed. | services |
| Duplicates | Unique indexes on email, on student + job for applications, and on student + job for saved jobs. | models |
| Input | Every request body is validated on the server (types, lengths, ranges, allowed values) and only whitelisted fields are stored. Values are turned into plain strings before reaching a query; ids must be ObjectIds; query strings cannot contain nested objects — so MongoDB operators cannot be injected. Search text is escaped before being used as a pattern. | `validators/`, `utils/text.js`, `app.js` |
| Output in the page | The frontend inserts data with `textContent` / `createElement`, never as HTML. Links from data are shown as text, or checked to be `http(s)` / a project page. | `assets/js` |
| Resume files | PDF only: the declared type, the size (≤ 500 KB, measured from the bytes received) and the file's first bytes are all checked. The file name is cleaned and used only as a label. Files are stored in the database, not on a public URL, and are sent only to their owner or to the recruiter of a job the student applied to, with `no-store` and `nosniff`. | `validators/profile-validator.js`, `services/profile-service.js` |
| Rate limiting | Login: 20 failed attempts per IP per 15 minutes (successful logins are not counted, so a class behind one network address is not locked out). Registration: 20 per IP per 15 minutes. All API routes: 300 requests per IP per minute. | `middleware/rate-limiters.js` |
| CORS | Only the origins listed in `FRONTEND_URL` may call the API from a browser. A wildcard is rejected at start-up. Cookies are not used, so credentials are off. | `app.js`, `config/env.js` |
| Headers | `helmet` defaults on the API. On Netlify: a Content-Security-Policy (own scripts and styles only, requests only to the site and the API), `X-Frame-Options: DENY`, `nosniff`, a referrer policy. | `app.js`, `netlify.toml` |
| Request size | JSON bodies up to 100 KB; resume uploads up to 500 KB. | `app.js`, `routes/index.js` |
| Errors | One format; unexpected errors return a generic message. Stack traces, queries and connection details are never sent. | `middleware/error-handler.js` |
| Logs | Method, path, status and duration only — no query strings, headers, bodies, tokens or passwords. Database connection errors are logged without the connection string. | `middleware/request-logger.js`, `config/database.js` |
| Secrets | `MONGODB_URI` and `JWT_SECRET` exist only as environment variables. `.env` is ignored by Git; `.env.example` and `render.yaml` hold no values. In production the server refuses to start with a missing or short secret. No secret is in any frontend file. | `config/env.js`, `.gitignore` |
| Seeding | The seed never deletes or overwrites. It refuses to create the admin with the public demo password on any database that is not on the local computer. | `scripts/seed.js` |
| Destructive admin action | "Reset demo data" is off unless `ALLOW_DEMO_RESET=true`, and even then keeps admin accounts. | `services/admin-service.js` |

These points are exercised by the API tests in `server/tests/` (see README, "Testing").

## 2. What is not protected — remaining risks

**Token theft (XSS).** The login token is kept in `sessionStorage`, where any script running on the
page can read it. If a cross-site-scripting bug existed, an attacker could copy the token and act as
that user for up to two hours. The project reduces the chance (no HTML built from data, a strict
Content-Security-Policy, no third-party scripts) but has not proved it away. An HttpOnly cookie would
hide the token from scripts; it was not used because the frontend and the API are on different sites,
where such cookies are increasingly blocked and would need CSRF protection as well.

**Logout is per user, not per device.** Logging out ends that user's sessions everywhere. A stolen
token cannot be cancelled individually; it stops working at logout or after two hours.

**No email verification.** Anyone can register with any email address. A recruiter is approved by an
admin looking at what they typed, not by checking who they are.

**No password reset or change.** A forgotten password cannot be recovered; there is no screen to
change one. An administrator would have to act directly in the database.

**No account lockout, CAPTCHA or two-factor login.** Guessing is slowed only by the per-IP rate
limit, which an attacker with many addresses can avoid, and whose counters live in memory and reset
whenever the free server restarts or sleeps.

**Public demo accounts.** The demo student and recruiter passwords are published in the README, so
on a deployed site anyone can log in as them, read their data and change it. Only the admin gets a
private password.

**Resume privacy.** Resumes are readable by the student, by every recruiter the student applied to,
and by anyone with access to the database (the Atlas account, or anyone who obtains `MONGODB_URI`).
They are not encrypted beyond what Atlas does for stored data, and are not scanned for malware — a
PDF can still carry harmful content for the person who opens it. A recruiter always sees the
student's *current* resume, not the one that existed when applying.

**Personal data.** Names, emails, phone numbers and education details are stored in plain form.
There is no consent screen, no data export or self-service account deletion, and no retention policy.

**Database exposure.** If Atlas network access is left open to all addresses (see DEPLOYMENT.md §1),
only the database password protects the data. There are no backups on the free tier.

**Admin power.** An admin can block or delete any account and delete jobs; there is no audit log of
who did what.

**Free hosting.** The service can sleep, restart or be withdrawn by the provider; there is no
monitoring or alerting; availability is not guaranteed.

**Dependencies.** The server uses eight npm packages (and their dependencies). `npm audit` reported
no known vulnerabilities when they were installed (October 2026); that will change over time and
nobody is assigned to keep them updated.

**Not tested.** No penetration test, no automated security scanner, no load test. The API tests show
that the rules above hold for the cases written; they cannot show the absence of other flaws.

## 3. If something goes wrong

- A secret was committed or shown: change it at once — reset the database user's password in Atlas
  and update `MONGODB_URI` on Render; replace `JWT_SECRET` on Render (everyone is logged out).
  Removing it from Git history afterwards does not make the old value safe again.
- An account is misused: an admin can block it on the Users page; the block applies to the account's
  next request.
- The data is damaged: there is no backup. Empty the collections in Atlas and run the seed again.
