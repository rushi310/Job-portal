# CLAUDE.md — FreshHire Master Development Instructions

> Read this file first, every session. It is the single source of truth for **how** work on FreshHire is done.
> Other documents describe **what** is built (PROJECT_SPEC.md), **how it is structured** (ARCHITECTURE.md),
> **how it looks** (UI_SPEC.md), **how code is written** (CODING_RULES.md), and **where we are** (PROJECT_STATUS.md).

---

## 1. Project Identity

- **Name:** FreshHire
- **Type:** Final-year college project — a job portal for freshers.
- **Nature:** **FULL-STACK** since Phase 15 (user-approved change, 2026-10-12): a static Vanilla
  JavaScript frontend, an Express REST API in `server/`, and MongoDB.
  Phases 0–14 built a frontend-only simulation; that history is kept in `PROJECT_STATUS.md`.
- **Roles:** Student, Recruiter, Admin.
- **Hosting target:** Netlify (frontend), Render (API), MongoDB Atlas (database) — free tiers.

## 2. Absolute Technology Rules (Non-Negotiable)

### Frontend (`index.html`, `pages/`, `assets/`)

| Purpose | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, Flexbox, Grid, media queries) |
| Logic | Vanilla JavaScript ES6+ (ES modules) |
| Data | The FreshHire API only, through `assets/js/core/api.js` |
| Per-tab state | `sessionStorage` (login token, job filters, flash message) |
| Charts | Inline SVG / CSS (hand-written) |
| Icons | Inline SVG or Unicode characters |

**Forbidden in the frontend:** React, Angular, Vue, Svelte, jQuery or any JS framework/library;
Bootstrap, Tailwind or any CSS framework; Chart.js or any charting library; bundlers, transpilers or a
frontend `package.json`; CDN scripts; `localStorage` for business data; any network call other than to
the project's own API; any secret (database string, token secret, password).

### Backend (`server/` only)

| Purpose | Technology |
|---|---|
| Runtime | Node.js (16.20.1 or newer; Render runs 20) |
| Web framework | Express 4 |
| Database | MongoDB through Mongoose |
| Auth | `bcryptjs` (password hashes), `jsonwebtoken` (bearer tokens) |
| Protection | `helmet`, `cors`, `express-rate-limit` |
| Configuration | `dotenv` + environment variables |
| Tests | `node:test`, `supertest`, `mongodb-memory-server` (dev dependencies) |

**Forbidden in the backend:** any other database or BaaS (SQL, Firebase, Supabase, …); paid services;
Docker as a requirement; new npm packages without the user's approval; secrets in source control;
anything that seeds or deletes data automatically at start-up.

Do not migrate the frontend to a framework. Do not move backend code outside `server/`.

## 3. Phase Gating (Mandatory)

Development follows the phases in `DEVELOPMENT_PHASES.md` (Phase 0 → Phase 15).

1. Work **only** on the phase recorded as current in `PROJECT_STATUS.md`.
2. **Never start the next phase without explicit approval from the user** (e.g. "Start Phase 3").
3. Do not build features belonging to future phases, even partially, except where a phase's deliverables explicitly say so.
4. At the end of every phase:
   - Verify every acceptance criterion listed for that phase in `DEVELOPMENT_PHASES.md`.
   - Update `PROJECT_STATUS.md` (phase status, checklist, change log, next task).
   - Update `README.md` if features, run instructions, or structure changed.
   - Report: files created/changed, current phase, next task.
   - Stop and wait for the user.

## 4. Document Map

| File | Purpose | Update when |
|---|---|---|
| `CLAUDE.md` | Master working rules (this file) | Rules change (user-approved only) |
| `PROJECT_STATUS.md` | Current phase, progress, next task, change log | End of every work session/phase |
| `DEVELOPMENT_PHASES.md` | Phase goals, deliverables, acceptance criteria | Scope change (user-approved only) |
| `PROJECT_SPEC.md` | Features, roles, business rules, data models | Requirements change |
| `ARCHITECTURE.md` | Folder structure, layers, storage, request flow | Structure changes |
| `UI_SPEC.md` | Design system, layouts, page inventory, components | UI decisions change |
| `CODING_RULES.md` | Code style and conventions | Conventions change |
| `README.md` | Public overview, run guide, credentials | Features/run steps change |
| `DEPLOYMENT.md` | Atlas, Render and Netlify set-up | Deployment steps or settings change |
| `docs/API.md` | Every API endpoint | An endpoint is added or changed |
| `docs/SECURITY.md` | Protections and remaining risks | Anything security-relevant changes |

If two documents ever disagree, **stop, report the contradiction to the user, and fix the documents** before writing code. Precedence while resolving: `CLAUDE.md` > `PROJECT_SPEC.md` > `ARCHITECTURE.md` > `UI_SPEC.md` > `CODING_RULES.md` > others.

## 5. Working Rules for Every Session

1. Read `CLAUDE.md` → `PROJECT_STATUS.md` → the current phase in `DEVELOPMENT_PHASES.md`.
2. Consult `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `UI_SPEC.md`, `CODING_RULES.md` before writing code.
3. Place every file exactly where `ARCHITECTURE.md` says. Do not invent new top-level folders.
4. Frontend: pages never call `fetch()` or touch `sessionStorage` directly — only through the
   service / core modules. `core/api.js` is the only module that calls the API.
5. All storage keys come from `assets/js/core/config.js` (prefix `fh_`). No hard-coded key strings elsewhere.
6. Escape all user-supplied text before inserting it into the DOM (prefer `textContent`).
7. **The server is the security boundary.** Every protected route checks the token, the role and the
   ownership of the data. Frontend guards and hidden buttons are presentation only. Never trust an
   id, role, owner, status, count or total sent by the client.
8. Every business rule in `PROJECT_SPEC.md` is enforced in a server service. A matching check in the
   frontend is allowed for quick feedback, never instead of the server check.
9. Backend layering: routes → controllers → validators + services → models. No database queries in
   routes or controllers. Only `config/env.js` reads `process.env`.
10. Never put secrets in the repository or in frontend files. Never log passwords, tokens or the
    database connection string. Never ask the user to paste secrets into chat.
11. Do not add dependencies without the user's approval.
12. Keep the app runnable after every change, and keep the API tests passing (`cd server && npm test`).
    Do not weaken or delete a test to make it pass.
13. Do not commit, push or deploy unless the user asks.
14. Keep code readable for viva: small functions, clear names, brief comments explaining *why*.

## 6. Honesty About the Project

FreshHire is an academic demo. Documentation and UI must never overstate it.
- It has real authentication and server-side authorization, but it is **not** production-secure;
  `docs/SECURITY.md` lists the remaining risks and must stay accurate.
- No real company hires through it; there is no email, SMS or identity verification.
- Show a small demo notice in the footer ("Demo project — not a real hiring service…").
- Never claim a live deployment, a test result or a browser check that was not actually done.
  Record in `PROJECT_STATUS.md` what was verified and what was not.

## 7. Definition of Done (any task)

- Works in the latest Chrome, Edge, and Firefox against a running API.
- No console errors or warnings from the application (the browser's own log line for an expected
  4xx answer, such as a refused login, does not count).
- API changes are covered by a test in `server/tests/`, and `npm test` passes.
- Follows `UI_SPEC.md` and `CODING_RULES.md`.
- Responsive at 360px width and above.
- Relevant docs updated (including `docs/API.md` and `docs/SECURITY.md` where they apply).
