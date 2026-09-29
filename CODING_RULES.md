# CODING_RULES.md — FreshHire Coding Conventions

> FreshHire is **frontend-only**: HTML5, CSS3, Vanilla JavaScript ES6+ (ES modules), JSON seed data,
> `localStorage`, and `sessionStorage`. No frameworks, libraries, build tools, or backend code.

---

## 1. General
- No dependencies: no npm, no CDN links, no `package.json`, no `node_modules`.
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
- Layout with Flexbox and Grid; no floats for layout.
- Avoid IDs for styling; avoid `!important` (utilities may use it sparingly).
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
- Only `core/storage.js` calls `localStorage`/`sessionStorage`.
- Only services contain business rules (eligibility, status transitions, validation of domain data).
- Constants (roles, statuses, keys, limits, `DATA_VERSION`) live in `core/config.js` — no magic strings.
- Functions do one thing and stay short (aim < 40 lines).
- Services return data or `{ ok, data, error }`; they never `alert()` or touch the DOM.
- Use event delegation for lists (one listener on the container, read `data-*` attributes).

### 5.4 DOM & Security
- Prefer `textContent`, `createElement`, and `<template>` elements.
- If `innerHTML` is used with any data, every dynamic value must pass through `escapeHtml()` from `core/utils.js`.
- Never use `eval`, `new Function`, or `document.write`.
- Validate and sanitise all form input in JS even if HTML validation attributes are present.
- Validate uploaded resume: MIME type `application/pdf` and size ≤ 500 KB (`MAX_RESUME_SIZE`).

### 5.5 Storage
- Always read/write JSON through `storage.js` helpers (`getLocal`, `setLocal`, `removeLocal`, `getSession`, `setSession`, `removeSession`).
- Handle `QuotaExceededError` in `setLocal` and surface a friendly error.
- Never store derived data (e.g. "expired", counts) — compute it.
- Bump `DATA_VERSION` in `config.js` whenever seed JSON structure changes.

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
- Never commit secrets (there should be none — this is a frontend-only demo).

## 9. Pre-Phase-Completion Checklist
- [ ] No console errors on any page touched.
- [ ] All new pages pass the role guard test (wrong role / no session).
- [ ] No inline styles or handlers; no hard-coded storage keys.
- [ ] Works at 360px, 768px, and 1280px widths.
- [ ] Docs updated (`PROJECT_STATUS.md`, and `README.md` if needed).
