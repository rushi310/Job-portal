# FreshHire — Live Demo Flow

A 10–12 minute live demo using only implemented features and the seed data.

## Before the demo

1. Start the app with a static server (VS Code → Live Server → `index.html`).
2. For a clean start: log in as admin → **Admin Dashboard** → **Reset demo data** → confirm. (Or clear the site's
   data in the browser.)
3. Keep one browser tab; switching accounts uses **Log out** (account menu, top right).
4. Optional: have a small PDF (under 500 KB) ready to show the resume upload.

## Script

| # | Step | What to show / say |
|---|---|---|
| 1 | Open FreshHire | "Frontend-only: HTML, CSS, JavaScript; data in the browser's localStorage." |
| 2 | Landing page | Hero, how it works, numbers, six newest open jobs, Log in / Register buttons |
| 3 | Log in as **student** | Login → **Use** next to *Student* → **Log in**. Lands on the Student Dashboard. |
| 4 | Dashboard | Stats, profile completeness, recent applications, recommended jobs, application status chart |
| 5 | Browse / search jobs | **Browse Jobs** → type `Python` → filter *Work mode: Remote* → change *Sort by* → **Clear filters** |
| 6 | Job details | **View details** on *Python Developer Intern* (BrightPath Analytics): skills with ✓, **Eligibility** box |
| 7 | Save the job | **♡ Save** → turns into **♥ Saved**; open **Saved Jobs** to show it |
| 8 | Apply | Back on the job → **Apply now** → cover note → **Submit application** → "Application submitted" |
| 9 | My Applications | New application at the top; status filter; **View timeline** on an older one; **Withdraw** is offered only for *Applied* / *Under Review* (you can show the confirmation and cancel) |
| 10 | Profile | **Profile & Resume**: tabs, completeness "Still to add", Resume tab (upload or **Print resume**) |
| 11 | Notification | Bell count → **Notifications** → **Mark as read** |
| 12 | Log out | Account menu → **Log out** |
| 13 | Log in as **recruiter** | **Use** next to *Recruiter* (Karan Shah, TechNova Pvt Ltd). The job from step 8 belongs to another company (BrightPath), so it does not appear here — a good moment to mention ownership. The demo continues with TechNova's own applicants. |
| 14 | Recruiter dashboard | Stats, recent applicants, **Applicants per job** chart, **Application funnel** |
| 15 | Job management | **My Jobs**: status filter, *Pending* job with "Waiting for admin approval", **Edit**, **Close** (show the confirmation, cancel). Optionally **Post a Job** → **Preview job**. |
| 16 | Applicants | **Applicants** for *Junior Frontend Developer* → **View profile** (details, history, resume) |
| 17 | Update a status | For *Priya Nair*: **Move to… Under Review** → **Update** → history updated; only valid next steps are offered |
| 18 | Log out | — |
| 19 | Log in as **admin** | **Use** next to *Admin* |
| 20 | Admin dashboard | Totals, jobs by status, recruiters and jobs awaiting approval |
| 21 | Approve a recruiter | **Users** → role *Recruiter*, status *Pending* → **Approve** Meera Joshi |
| 22 | Approve / reject a job | **Jobs** → *Pending* → **View** → **Approve** one; **Reject** another with a reason |
| 23 | Reports | **Reports**: four charts with tables; **Export CSV** and open the file |
| 24 | (Optional) Announcement | **Announcements** → audience *All students* → send → shows in the students' notifications |
| 25 | Mobile view | Browser DevTools device mode (e.g. 390px): ☰ menu drawer, stacked tables |
| 26 | Wrap up | Architecture (pages → services → storage), what is simulated, limitations, future scope |

## If something goes wrong

| Situation | Recovery |
|---|---|
| Page blank / module errors | The app was opened as a file — open it through the static server. |
| Data looks different from this script | Admin → **Reset demo data**. |
| Logged out unexpectedly | The session is per tab; log in again (closing the tab ends the session). |
| "Browser storage is full" | Remove the uploaded resume or reset the demo data. |

## Points to mention during the demo

- Pending recruiters can log in but cannot post jobs — enforced in the services, not just hidden.
- A recruiter cannot see another recruiter's jobs or applicants (try another job id in the URL: "Job not found").
- Everything is saved in `localStorage` — refresh any page and the changes are still there.
- This is a simulation: DevTools can change the data, so it is not real security.
