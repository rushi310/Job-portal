# FreshHire

**A simulated job portal for freshers — final-year college project.**

> ⚠️ **FreshHire is a FRONTEND-ONLY project.**
> It is built entirely with HTML5, CSS3, and Vanilla JavaScript (ES6+). Mock data comes from JSON files and is
> stored in the browser's `localStorage`; the login session uses `sessionStorage`.
> There is **no backend, no database, and no API server**. All "server" behaviour is simulated in the browser.

---

## Project Status

**Current phase: Phase 1 — Project Setup & Base UI (complete).** The landing page, design system, core modules, and seed data are in place. Login and all role portals come in later phases.
See [PROJECT_STATUS.md](PROJECT_STATUS.md) for live progress.

## About

FreshHire helps freshers find entry-level jobs and internships. It supports three roles:

| Role | What they can do |
|---|---|
| **Student** | Search & filter jobs, view details, check eligibility, apply, save jobs, track applications, build a profile, upload/generate a resume, get notifications |
| **Recruiter** | Post and manage jobs (after admin approval), review applicants, update application status, manage company profile |
| **Admin** | Approve recruiters and jobs, block/delete users, send announcements, view reports and export CSV, reset demo data |

## Technology

| Used | Not used |
|---|---|
| HTML5, CSS3, Vanilla JavaScript ES6+ (ES modules) | Node.js, Express, any backend |
| JSON mock data (`/data`) | MongoDB, SQL, any database |
| `localStorage`, `sessionStorage` | Firebase, Supabase, any BaaS |
| Canvas/SVG hand-drawn charts | React, Angular, Vue, jQuery |
| System fonts, inline SVG icons | Bootstrap, Tailwind, Chart.js, CDNs, npm |

## How to Run

The app must be opened through a **static file server**, because browsers block ES modules and `fetch()` of JSON files on `file://` URLs. The static server only delivers files — it is not a backend.

1. Open the project folder in **VS Code**.
2. Install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server**.

No installation, build step, or internet connection is required.

On the first visit, demo data from `/data/*.json` is copied into `localStorage` (a "Demo data loaded" toast appears). To start fresh, clear this site's data in the browser's DevTools (Application → Storage → Clear site data).

## Demo Credentials (available from Phase 2)

| Role | Email | Password |
|---|---|---|
| Admin | admin@freshhire.com | Admin@123 |
| Student | student@freshhire.com | Student@123 |
| Recruiter | recruiter@freshhire.com | Recruiter@123 |

## Project Structure

```
index.html          Landing page
pages/              auth/, student/, recruiter/, admin/, shared/ HTML pages
assets/css/         Design tokens, base, layout, components, page styles
assets/js/          core/, services/, components/, pages/ (ES modules)
assets/images/      Logo and illustrations
data/               JSON seed data
docs/               Test cases, user guide, viva notes (Phases 13–14)
```
Full details: [ARCHITECTURE.md](ARCHITECTURE.md).

## Documentation

| Document | Contents |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Master development instructions |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Current phase and progress |
| [DEVELOPMENT_PHASES.md](DEVELOPMENT_PHASES.md) | Phase 0–14 roadmap with acceptance criteria |
| [PROJECT_SPEC.md](PROJECT_SPEC.md) | Features, business rules, data models |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Folder structure, layers, storage design |
| [UI_SPEC.md](UI_SPEC.md) | Design system and page layouts |
| [CODING_RULES.md](CODING_RULES.md) | Coding conventions |

## Development Phases

0 Planning · 1 Project Setup & Base UI · 2 Login & Registration · 3 Student Dashboard · 4 Job Listing & Search ·
5 Job Details & Applications · 6 Saved Jobs & Application Tracking · 7 Student Profile & Resume · 8 Recruiter Portal ·
9 Admin Portal · 10 Notifications · 11 Analytics & Reports · 12 Responsive Design & UI Polish · 13 Testing ·
14 Documentation & Viva

## Limitations (by design)

- Passwords are stored in plain text in `localStorage` — **for demonstration only**, not secure.
- Data exists only in the current browser; clearing site data resets it to the seed data.
- Data is not shared between devices or browsers.
- Resume uploads are limited to 500 KB PDFs because of the `localStorage` size limit.

## License

Academic project — for educational use.
