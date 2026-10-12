# CODING_RULES.md — FreshHire Coding Conventions

> **Frontend:** HTML5, CSS3, Vanilla JavaScript ES6+ (ES modules) — no frameworks, libraries or build tools.
> **Backend (`server/`, Phase 15):** Node.js, Express, Mongoose — see §10.
> Sections 1–9 are about the frontend unless they say otherwise.

---

## 1. General
- Frontend: no dependencies — no npm, no CDN links, no `package.json`. (The backend has its own
  `server/package.json`; see §10.)
- UTF-8 encoding, LF or CRLF consistently, 2-space indentation, no tabs.
- Maximum line length ~100 characters where practical.
- Remove dead code, commented-out code, and `console.log` before finishing a phase (`console.error` for genuine errors is allowed).
- Write code a classmate or examiner can read: prefer clarity over cleverness.

## 2. File Naming
| Item | Convention | Example |
|---|---|---|
| HTML, CSS, JS, JSON files | `kebab-case` | `job-details.html`, `application-service.js` |
| Folders | lowercase `kebab-case` | `pages/student/` |
| Page script | Same base name as its HTML page | `pages/admin/users.html` ↔ `assets/js/pages/admin/users.js` |
| Images | `kebab-case` | `hero-illustration.svg` |

## 3. HTML
- `<!DOCTYPE html>`, `<html lang="en">`, `<meta charset="UTF-8">`, viewport meta, descriptive `<title>` ("Browse Jobs · FreshHire").
- Use semantic elements: `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`, `button` (never clickable `div`s).
- Every form control has a `<label>`; use proper `type` attributes (`email`, `tel`, `number`, `date`).
- CSS order in `<head>`: `variables.css` → `base.css` → `layout.css` → `components.css` → `utilities.css` → page CSS.
- Exactly one script per page, at the end of `<head>` with `type="module"` (modules are deferred by default).
- No inline `style="..."` and no inline event handlers (`onclick="..."`).
- Use `data-*` attributes as JS hooks (e.g. `data-action="save-job"`), not styling classes.
- All paths are **relative** (no leading `/`).

## 4. CSS
- Use design tokens from `variables.css` — no hard-coded colours, font sizes, or spacing values in other files.
- Class naming: **BEM** — `block`, `block__element`, `block--modifier` (e.g. `job-card`, `job-card__title`, `btn--primary`).
- State classes prefixed `is-` / `has-` (e.g. `is-active`, `is-open`, `has-error`).
- Mobile-first: base styles for small screens, then `@media (min-width: ...)` using the breakpoints in `UI_SPEC.md`.
  Exception in the final code: four phone-only overrides use `max-width` (stacked tables below 768px; table,
  report-table and resume-preview padding below 576px), because they only apply to the smallest screens.
- Layout with Flexbox and Grid; no floats for layout.
- Avoid IDs for styling; avoid `!important` (utilities may use it sparingly). The only other uses are the
  `prefers-reduced-motion` rule in `base.css` and the resume print rule in `student.css`, which must win.
- Keep selector nesting shallow (max 3 levels).
- Order inside a rule: positioning → box model → typography → visual → misc.

## 5. JavaScript

### 5.1 Language
- ES6+ modules with `import` / `export`; always include the `.js` extension in import paths.
- `'use strict'` is implicit in modules — do not add it.
- `const` by default, `let` when reassigned, **never `var`**.
- Arrow functions for callbacks; named `function` declarations for top-level functions.
- Template literals for strings with variables.
- Strict equality (`===`, `!==`) only.
- Use `async`/`await` for `fetch`; wrap in `try/catch`.
- No global variables; nothing attached to `window`.

### 5.2 Naming
| Item | Convention | Example |
|---|---|---|
| Variables, functions | `camelCase` | `getApprovedJobs`, `isEligible` |
| Constants / config | `UPPER_SNAKE_CASE` | `STORAGE_KEYS`, `MAX_RESUME_SIZE` |
| Booleans | `is/has/can` prefix | `isExpired`, `hasApplied` |
| Event handlers | `handle` prefix | `handleApplySubmit` |
| Render functions | `render` prefix | `renderJobList` |
| DOM element refs | `El` suffix | `searchInputEl` |
| Storage keys | `fh_` prefix, `snake_case` | `fh_saved_jobs` |
| ID prefixes | `usr_`, `job_`, `app_`, `ntf_` | `job_lx2k9a_4f7` |

### 5.3 Structure
- Respect the layer rules in `ARCHITECTURE.md` §1: pages → components/services → core.
- Only `core/storage.js` touches `sessionStorage`; only `core/api.js` calls `fetch()`. `localStorage` is not used.
- Business rules are enforced by the server. Frontend services call the API and may repeat a rule only to
  give quick feedback in a form (the server's answer always wins).
- Service functions that call the API are `async` and resolve to `{ ok: true, data }` or
  `{ ok: false, code, error, fieldErrors? }`; pages `await` them and show a loading state meanwhile.
- Constants (roles, statuses, keys, limits) live in `core/config.js` — no magic strings. The API address
  lives in `core/app-config.js`.
- Functions do one thing and stay short (aim < 40 lines).
- Services return data or `{ ok, data, error }`; they never `alert()` or touch the DOM.
- Use event delegation for lists (one listener on the container, read `data-*` attributes).

### 5.4 DOM & Security
- Prefer `textContent`, `createElement`, and `<template>` elements.
- If `innerHTML` is used with any data, every dynamic value must pass through `escapeHtml()` from `core/utils.js`.
  In the final code `innerHTML` is used only in `components/icons.js`, for the project's own static SVG strings.
- Never use `eval`, `new Function`, or `document.write`.
- Validate and sanitise all form input in JS even if HTML validation attributes are present.
- Validate uploaded resume: MIME type `application/pdf` and size ≤ 500 KB (`MAX_RESUME_SIZE`).

### 5.5 Storage
- The browser stores only per-tab conveniences, through `storage.js` helpers (`getSession`, `setSession`,
  `removeSession`, `setFlash`, `consumeFlash`): the login token, the last job filters, a one-time message.
- Never keep business data (users, jobs, applications, notifications) in the browser.
- Never store derived data (e.g. "expired", counts) — the server computes it for each request.

### 5.6 Errors
- Catch errors at page level; show a toast, not a raw error.
- Unexpected errors: `console.error` with context.

### 5.7 Comments
- A short header comment at the top of each JS file describing its purpose.
- JSDoc (`/** ... */`) for exported functions: purpose, params, return value.
- Comment the *why*, not the obvious *what*.

## 6. JSON Seed Data
- Files in `/data` hold arrays of objects matching the models in `PROJECT_SPEC.md` §5.
- Realistic but fictional names, companies, and emails (`@example.com`, except the demo accounts `@freshhire.com`).
- Valid JSON only (double quotes, no comments, no trailing commas).

## 7. Accessibility (code-level)
- Follow the checklist in `UI_SPEC.md` §7.
- Toggle `aria-expanded` on menu/drawer buttons; use `aria-live` regions for toasts and result counts.
- Manage focus on modal open/close and after page-level errors.

## 8. Version Control (recommended, not required)
- If Git is used: small commits per feature, messages like `feat(student): add job search filters`.
- Never commit secrets. `server/.env` is ignored by Git; `.env.example` and `render.yaml` contain no values.

## 9. Pre-Phase-Completion Checklist
- [ ] No console errors on any page touched.
- [ ] All new pages pass the role guard test (wrong role / no session).
- [ ] No inline styles or handlers; no hard-coded storage keys.
- [ ] Works at 360px, 768px, and 1280px widths.
- [ ] Docs updated (`PROJECT_STATUS.md`, and `README.md` if needed).

## 10. Backend (`server/`)

- **Language:** Node.js, CommonJS modules (`require` / `module.exports`), `async` / `await`. Same naming, comment
  and formatting rules as the frontend (§1, §5.2, §5.7).
- **Layers** (ARCHITECTURE.md §1): `routes` declare who may call what → `controllers` read the request and send
  the response → `validators` check input and build whitelisted values → `services` hold the business rules
  and queries → `models` define schemas and indexes. No queries in routes or controllers; no `req` / `res` in
  services.
- **Identity:** the acting user is `req.user` (loaded from the database by `middleware/auth.js`). Never read a
  user id, role, owner or status from the body, query or URL to decide who is acting or what they own.
- **Ownership in the query:** find a record together with its owner (`{ _id, recruiter: req.user._id }`), and
  answer "not found" for someone else's record.
- **State changes are conditional updates:** `findOneAndUpdate` with the expected current status in the filter,
  so two requests at once cannot both succeed. Uniqueness is enforced by an index, not only by a prior check.
- **Input:** never pass `req.body` or `req.query` to a model. Validators turn values into plain strings / numbers
  (`utils/text.js`) and copy only named fields. Escape text before using it in a pattern.
- **Output:** send data only through `utils/serializers.js` and `sendData`; never a Mongoose document directly.
- **Errors:** throw an `AppError` (helpers in `utils/app-error.js`); the central handler formats it. Messages are
  written for the user; never include stack traces, queries or configuration.
- **Configuration:** only `config/env.js` reads `process.env`. New settings are added there, to
  `.env.example` and to `render.yaml` (without secret values).
- **Logging:** `console.info` / `console.error` with no personal data, passwords, tokens or connection strings.
- **Notifications** are created in the service that made the change, after it succeeded, and never by a read.
- **Tests:** every route has tests in `server/tests/` for the allowed case and for the refused ones (logged
  out, wrong role, someone else's record, invalid input). Tests use the helpers in `tests/helpers.js` and an
  in-memory database; they never connect to a real one. Wrap each file in one top-level `describe` that owns
  `before` / `after` (file-level hooks do not run on Node 16).
- **Dependencies:** only those listed in CLAUDE.md §2; adding one needs the user's approval.
