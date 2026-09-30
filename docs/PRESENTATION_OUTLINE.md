# FreshHire — Presentation Outline

About 15 slides for a 10–15 minute talk, followed by the live demo ([DEMO_FLOW.md](DEMO_FLOW.md)). Screenshots
for the slides are in [screenshots/](screenshots/).

| # | Slide | Key points (keep each slide short) | Visual |
|---|---|---|---|
| 1 | **Title** | FreshHire — a job portal for freshers · name, guide, college, year | `01-landing.png` |
| 2 | **Problem** | Freshers apply to jobs they're not eligible for · applications are hard to track · small recruiters lack a simple tool | — |
| 3 | **Objective** | A complete multi-role portal using only HTML, CSS and Vanilla JS · realistic hiring workflow · responsive and accessible | — |
| 4 | **Target users** | Student (fresher) · Recruiter (needs admin approval) · Admin (seed account) | Role table |
| 5 | **Features** | Search / filters / eligibility / apply / track · post jobs / review applicants · approve / moderate / report · notifications · charts | `05-browse-jobs.png` |
| 6 | **Architecture** | Pages → components + services → core → localStorage / sessionStorage · JSON seed data · no backend, no database · rules live in services | Layer diagram (README) |
| 7 | **Student workflow** | Register → browse → job details + eligibility → apply → track timeline → withdraw · profile completeness · resume | `06-job-details.png`, `09-my-applications.png` |
| 8 | **Recruiter workflow** | Register (pending) → admin approves → post job (pending) → admin approves → applicants → status flow | `13-post-job.png`, `15-applicants.png` |
| 9 | **Admin workflow** | Approve recruiters and jobs · reject with reason · block / delete · announcements · reset demo data | `18-admin-recruiter-approval.png`, `19-admin-job-approval.png` |
| 10 | **Notifications** | 5 events · unread count on the bell · mark read / all · each user sees only their own | `11-notifications.png` |
| 11 | **Analytics** | Calculated from stored data · hand-drawn SVG charts · tables + CSV export · per-role scope | `20-admin-reports.png` |
| 12 | **Testing** | 19 automated suites, 1,254 checks, all passed in Edge and Firefox · 240 layout renders · Lighthouse accessibility 100 · keyboard and mobile emulation · 3 defects fixed in Phase 13 | Results table |
| 13 | **Limitations** | Frontend-only · not secure (plain-text demo passwords, editable storage) · ~5 MB storage, 500 KB resumes · data per browser | — |
| 14 | **Future scope** | Backend API + database · hashed passwords and secure sessions · server-side checks · file storage · email / real-time notifications | — |
| 15 | **Conclusion** | Working three-role portal · clean layered design ready for a backend · honest about security limits · questions | `22-mobile-student-dashboard.png` |

## Speaker tips

- Say early that it is **frontend-only** and security is simulated — examiners will ask.
- On the architecture slide, explain one rule end to end, e.g. "a recruiter updates a status → service checks
  ownership and the allowed next step → history appended → student notified".
- Quote only the test numbers above (they are the recorded Phase 13 results), and say that the test pages were run
  in the development environment and are not in the repository.
