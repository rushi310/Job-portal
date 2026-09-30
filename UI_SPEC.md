# UI_SPEC.md — FreshHire UI & Design System

> FreshHire is a **frontend-only** project; the UI is rendered entirely in the browser.
> All UI is hand-written HTML5 + CSS3. No CSS frameworks, no icon fonts, no external fonts or CDNs.
> Tokens below are implemented as CSS custom properties in `assets/css/variables.css` (Phase 1).

---

## 1. Design Principles
1. **Clean and friendly** — freshers should feel welcomed, not overwhelmed.
2. **Consistent** — every page is built from the same tokens and components.
3. **Mobile-first** — base styles target small screens; larger layouts are added with `min-width` media queries.
4. **Accessible** — WCAG AA contrast, keyboard operable, clear focus, labelled inputs.
5. **Honest** — the footer always shows: "Demo project — data stored locally in your browser."

## 2. Design Tokens

### 2.1 Colors
| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#4F46E5` | Primary buttons, links, active nav |
| `--color-primary-hover` | `#4338CA` | Hover/active of primary |
| `--color-primary-light` | `#EEF2FF` | Selected backgrounds, highlights |
| `--color-secondary` | `#0EA5E9` | Secondary accents, info |
| `--color-success` | `#16A34A` | Success toasts, `selected`, `approved` |
| `--color-warning` | `#D97706` | `pending`, `interview`, warnings |
| `--color-danger` | `#DC2626` | Errors, `rejected`, destructive actions |
| `--color-text` | `#111827` | Body text |
| `--color-text-muted` | `#6B7280` | Secondary text, hints |
| `--color-border` | `#E5E7EB` | Borders, dividers |
| `--color-bg` | `#F9FAFB` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, panels, modals |

### 2.2 Status Badge Colors
| Status | Badge style |
|---|---|
| `applied` | primary-light bg / primary text |
| `under_review` | secondary tint |
| `shortlisted` | secondary solid |
| `interview` | warning tint |
| `selected` | success tint |
| `rejected` | danger tint |
| `withdrawn` | grey tint |
| Job `pending` | warning tint |
| Job `approved` | success tint |
| Job `rejected` | danger tint |
| Job `closed` / Expired | grey tint |
| User `active` / `pending` / `blocked` | success / warning / danger tint |

Badges always show text (not color alone), e.g. "Under Review".

### 2.3 Typography
- Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (no web-font download).
- Base size `16px`, line-height `1.5`.

| Token | Size | Use |
|---|---|---|
| `--fs-xs` | 0.75rem | Badges, captions |
| `--fs-sm` | 0.875rem | Hints, table text |
| `--fs-base` | 1rem | Body |
| `--fs-lg` | 1.125rem | Card titles |
| `--fs-xl` | 1.5rem | Section headings (h2) |
| `--fs-2xl` | 2rem | Page titles (h1) |
| `--fs-3xl` | 2.5rem | Landing hero |

Weights: 400 body, 500 labels, 600 headings/buttons, 700 hero.

### 2.4 Spacing, Radius, Shadow
- Spacing scale (`--space-1` … `--space-8`): 4, 8, 12, 16, 24, 32, 48, 64 px.
- Radius: `--radius-sm` 4px, `--radius-md` 8px, `--radius-lg` 12px, `--radius-full` 9999px.
- Shadow: `--shadow-sm` (cards), `--shadow-md` (dropdowns), `--shadow-lg` (modals).
- Transition: `--transition` 150ms ease. Respect `prefers-reduced-motion`.

### 2.5 Breakpoints (mobile-first, `min-width`)
| Name | Min width | Typical layout |
|---|---|---|
| base | 0 | Single column, hamburger menu, sidebar hidden in a drawer |
| `sm` | 576px | Two-column card grids |
| `md` | 768px | Forms in two columns; tables stay scrollable |
| `lg` | 1024px | Persistent sidebar visible |
| `xl` | 1280px | Max content width `1200px`, centred |

Minimum supported width: **360px**. No horizontal page scroll at any width (wide tables scroll inside their own container).

## 3. Layouts

### 3.1 Public Layout (landing, login, register)
```
┌─────────────────────────────────────────────┐
│ Header: Logo  ·  Jobs preview · Login · Register │
├─────────────────────────────────────────────┤
│                 Page content                │
├─────────────────────────────────────────────┤
│ Footer: © FreshHire · demo notice           │
└─────────────────────────────────────────────┘
```
Login/Register use a slim header (logo + "Back to home") instead of the full public header, and a centred card (max-width 480px) on a light background.

### 3.2 App Shell (all logged-in pages)
```
┌──────────────────────────────────────────────────────┐
│ Top bar: ☰ (mobile) Logo   ·······   🔔  User menu ▾ │
├────────────┬─────────────────────────────────────────┤
│ Sidebar    │  Page title + breadcrumb / actions       │
│ (role nav) │  ─────────────────────────────────────── │
│            │  Content (cards / tables / forms)        │
│            │                                          │
├────────────┴─────────────────────────────────────────┤
│ Footer                                               │
└──────────────────────────────────────────────────────┘
```
- Sidebar width 240px at `lg`+; below `lg` it is an off-canvas drawer opened by ☰.
- The bell icon appears from Phase 10; before that it is omitted.
- Sidebar items for pages not yet built are shown disabled with a "Soon" tag.

### 3.3 Sidebar Navigation by Role
| Student | Recruiter | Admin |
|---|---|---|
| Dashboard | Dashboard | Dashboard |
| Browse Jobs | Post a Job | Users |
| My Applications | My Jobs | Jobs |
| Saved Jobs | Company Profile | Announcements |
| Profile & Resume | Notifications | Reports |
| Notifications | | Notifications |

Applicants (recruiter) and Job Details (student) are reached from lists, not the sidebar.

## 4. Components (built in `components.css` + `assets/js/components/`)

| Component | Notes |
|---|---|
| Button | Variants: `btn--primary`, `btn--secondary`, `btn--outline`, `btn--danger`, `btn--ghost`; sizes `btn--sm`, `btn--lg`; disabled and loading states |
| Form field | Label above input, hint text, inline error below (red text + `aria-invalid="true"` + `aria-describedby`) |
| Inputs | text, email, password (show/hide toggle), select, textarea, checkbox, radio, file |
| Card | Surface, radius-lg, shadow-sm, padding space-5 |
| Stat card | Icon, big number, label; used on dashboards |
| Job card | Title, company, location, type, work mode, salary/stipend, skill chips, deadline, badges, Save (♡) and View actions |
| Badge / Chip | Status badges (§2.2); skill chips |
| Table | Striped rows, sticky header, horizontal scroll wrapper on small screens |
| Tabs | Used on profile and applicants pages |
| Modal | Focus-trapped, closes on Esc/backdrop, `role="dialog"` + `aria-modal="true"`; used for confirmations |
| Toast | Top-right (bottom-center on mobile), auto-dismiss 4s, `aria-live="polite"`; success/error/info/warning |
| Empty state | Illustration/icon + message + action button |
| Pagination | Prev / numbered / Next; 9 job cards per page |
| Timeline | Vertical list for application `statusHistory` |
| Progress bar | Profile completeness |
| Search bar + filter panel | Filters collapse into a drawer on mobile |
| Charts (Phase 11) | Bar, donut, line — drawn with Canvas/SVG; always accompanied by a data table or labels |

## 5. Page Specifications (summary)

| Page | Key UI |
|---|---|
| Landing | Hero ("Your first job starts here") + CTAs, 3-step "How it works", featured jobs (6 latest approved), stats strip, footer |
| Login | Email, password (show/hide), submit, link to register, demo credentials hint box |
| Register | Role toggle (Student / Recruiter); common fields (name, email, phone, password, confirm); student fields (college, degree, branch, graduation year, CGPA); recruiter fields (company name, designation, website, location) |
| Student Dashboard | Greeting, 4 stat cards (Applications, Shortlisted, Saved jobs, Profile complete), profile completeness bar with missing items, recent applications list (5 newest by activity), recent updates (3 newest notifications + unread count; read-only until Phase 10), recommended jobs (3, skill match; latest open jobs when nothing matches), quick actions ("Soon" until their pages exist). Stats: 1 / 2 / 4 columns; 2 columns between 1024–1279px because of the sidebar |
| Browse Jobs | Search bar (debounced 300 ms; Enter searches at once), filter panel, sort select, result count ("N jobs found · showing a–b", polite live region), job card grid, pagination, empty state with "Clear filters". Filter panel is inline (240px column) from 1024px and a right-hand drawer below 1024px, opened by a "Filters" button that shows the active-filter count |
| Job Details | Header (title, company, badges), key facts grid, description, responsibilities, skills, eligibility box with ✓/✗ per rule, Apply / Save buttons, apply modal with cover note |
| My Applications | Status filter tabs, list/table of applications, expandable timeline, Withdraw button where allowed |
| Saved Jobs | Job card grid with Unsave; empty state linking to Browse Jobs |
| Profile & Resume | Tabs: Personal, Education, Skills, Projects & Links, Resume (upload PDF / generate printable resume) |
| Recruiter Dashboard | Pending-approval banner if applicable, stat cards, recent applicants |
| Post / Edit Job | Multi-section form with validation, skills chip input, eligibility section, preview before submit |
| My Jobs | Status filter, table of jobs with applicant counts, Edit / Close / View applicants actions |
| Applicants | Job summary, applicant table, status select per row, view-profile modal with resume download |
| Company Profile | Editable company details |
| Admin Dashboard | Platform stat cards, pending approvals quick lists, Reset demo data (danger zone) |
| Users | Search, role/status filters, table with Approve / Block / Unblock / Delete |
| Jobs (admin) | Status filter, table, Approve / Reject (reason modal) / Delete |
| Announcements | Audience select, title, message, send; list of sent announcements |
| Reports | Charts (users by role, jobs by status, applications by status, applications over time), tables, Export CSV |
| Notifications | List grouped by date, unread styling, Mark all as read, click navigates to `link` |

## 6. Interaction & Feedback Rules
- Every action gives feedback: toast on success/failure, inline errors on forms.
- Destructive actions (delete, block, reject, withdraw, reset data) always require a confirmation modal.
- Validate on blur and on submit; focus the first invalid field on submit.
- Buttons show a loading/disabled state while an action runs to prevent double submits.
- Lists show an empty state rather than a blank area.
- Dates are displayed as `29 Sep 2026`; relative time ("2 days ago") for notifications.
- Currency displayed in INR: `₹3.0 – 4.5 LPA` for yearly, `₹15,000 /month` for stipend.

## 7. Accessibility Checklist
- One `<h1>` per page; logical heading order.
- Landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`; "Skip to content" link.
- All inputs have `<label for>`; icons-only buttons have `aria-label`.
- Visible `:focus-visible` outline (2px primary).
- Color contrast ≥ 4.5:1 for text.
- Modals trap focus and return it to the trigger on close.
- Charts have text alternatives.

## 8. Assets
- Logo: simple SVG wordmark "FreshHire" in `assets/images/logo.svg`.
- Icons: inline SVG snippets (no icon fonts or libraries).
- Avatars: initials in a coloured circle (generated in JS), no image uploads for avatars.
