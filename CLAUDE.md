# CLAUDE.md — FreshHire Master Development Instructions

> Read this file first, every session. It is the single source of truth for **how** work on FreshHire is done.
> Other documents describe **what** is built (PROJECT_SPEC.md), **how it is structured** (ARCHITECTURE.md),
> **how it looks** (UI_SPEC.md), **how code is written** (CODING_RULES.md), and **where we are** (PROJECT_STATUS.md).

---

## 1. Project Identity

- **Name:** FreshHire
- **Type:** Final-year college project — a *simulated* job portal for freshers.
- **Nature:** **FRONTEND-ONLY.** There is no backend, no database server, no API server, and no build step.
- **Roles:** Student, Recruiter, Admin (all simulated in the browser).

## 2. Absolute Technology Rules (Non-Negotiable)

### Allowed
| Purpose | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, Flexbox, Grid, media queries) |
| Logic | Vanilla JavaScript ES6+ (ES modules) |
| Seed / mock data | JSON files in `/data` |
| Persistent data | `localStorage` |
| Per-tab session | `sessionStorage` |
| Charts | Canvas API / inline SVG / CSS (hand-written) |
| Icons | Inline SVG or Unicode characters |
| Local preview | Any **static file server** (e.g. VS Code "Live Server" extension). It only serves files; it runs no project code. |

### Forbidden
- Node.js, npm packages, Express, or any server-side code
- MongoDB, SQL, SQLite, IndexedDB-as-backend-substitute, or any database server
- Firebase, Supabase, Appwrite, or any BaaS
- React, Angular, Vue, Svelte, jQuery, or any JS framework/library
- Bootstrap, Tailwind, or any CSS framework
- Chart.js or any charting library
- Any external API server or network call other than `fetch()` of the project's own `/data/*.json` files
- Bundlers, transpilers, `package.json`, `node_modules`
- Backend folders such as `server/`, `backend/`, `api/`, `routes/`, `models/`, `controllers/`

If a feature seems to need a backend, **simulate it** with `localStorage` and document the simulation. Never add a backend.

## 3. Phase Gating (Mandatory)

Development follows the 15 phases in `DEVELOPMENT_PHASES.md` (Phase 0 → Phase 14).

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
| `ARCHITECTURE.md` | Folder structure, modules, storage keys, data flow | Structure changes |
| `UI_SPEC.md` | Design system, layouts, page inventory, components | UI decisions change |
| `CODING_RULES.md` | Code style and conventions | Conventions change |
| `README.md` | Public overview, run guide, credentials | Features/run steps change |

If two documents ever disagree, **stop, report the contradiction to the user, and fix the documents** before writing code. Precedence while resolving: `CLAUDE.md` > `PROJECT_SPEC.md` > `ARCHITECTURE.md` > `UI_SPEC.md` > `CODING_RULES.md` > others.

## 5. Working Rules for Every Session

1. Read `CLAUDE.md` → `PROJECT_STATUS.md` → the current phase in `DEVELOPMENT_PHASES.md`.
2. Consult `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `UI_SPEC.md`, `CODING_RULES.md` before writing code.
3. Place every file exactly where `ARCHITECTURE.md` says. Do not invent new top-level folders.
4. Pages never touch `localStorage`/`sessionStorage` directly — only through the service/core modules.
5. All storage keys come from `assets/js/core/config.js` (prefix `fh_`). No hard-coded key strings elsewhere.
6. Escape all user-supplied text before inserting it into the DOM (prefer `textContent`).
7. Keep the app runnable after every phase — no broken links to pages that don't exist yet (use disabled "Coming soon" items instead).
8. Do not add dependencies. Do not create `package.json`.
9. Keep code readable for viva: small functions, clear names, brief comments explaining *why*.

## 6. Honesty About the Simulation

FreshHire is a simulation. Documentation and UI must never claim real security or real hiring.
- Passwords are stored in `localStorage` in plain text **for demonstration only**.
- Data lives only in the current browser; clearing site data resets the app to seed data.
- Show a small "Demo project — data stored locally in your browser" notice in the footer.

## 7. Definition of Done (any task)

- Works in the latest Chrome, Edge, and Firefox when served by a static server.
- No console errors or warnings.
- Follows `UI_SPEC.md` and `CODING_RULES.md`.
- Responsive at 360px width and above (full polish in Phase 12).
- Relevant docs updated.
