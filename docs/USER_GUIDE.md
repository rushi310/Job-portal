# FreshHire — User Guide

Step-by-step instructions for each role. FreshHire is a frontend-only demo: everything you do is saved in
**this browser only**. Start the app as described in the [README](../README.md#how-to-run).

Demo accounts (the login page's **Use** buttons fill them in):

| Role | Email | Password |
|---|---|---|
| Student | student@freshhire.com | Student@123 |
| Recruiter | recruiter@freshhire.com | Recruiter@123 |
| Admin | admin@freshhire.com | Admin@123 |

---

## 1. Getting started (everyone)

1. Open `index.html` through the static server. The landing page shows how FreshHire works, platform numbers
   and the six newest open jobs.
2. **Register:** choose **Create free account** (or **Register** in the top bar), pick **Student** or
   **Recruiter**, fill in the form and submit. You are taken to the login page with your email filled in.
   Admin accounts cannot be registered.
3. **Log in** with your email and password. You land on your role's dashboard.
4. **Navigate** with the sidebar. On phones and tablets (below 1024px) open it with the **☰** button; close it with
   **✕**, **Esc** or by tapping outside.
5. **Account menu** (your name / initials, top right): profile link and **Log out**. Closing the browser tab also
   ends the session.
6. **Notifications:** the bell shows the number of unread notifications.

## 2. Student

### Find jobs
1. Open **Browse Jobs**.
2. Type in **Search jobs** (title, company or skill — results update as you type).
3. Narrow the list with **Filters**: location, job type, work mode, salary / stipend range and skills (a job must
   list every selected skill). On smaller screens the filters open in a side panel.
4. Change **Sort by** (newest, deadline, salary). Tick **Show expired jobs** to include jobs whose deadline has
   passed. **Clear filters** resets everything.
5. Use the page numbers at the bottom (9 jobs per page). Your last search is remembered while the tab stays open.

### Look at a job and apply
1. Choose **View details** on a job card.
2. Read the description, responsibilities and skills (skills you have are ticked) and the **Eligibility** box,
   which shows whether you meet each rule (degree, graduation year, minimum CGPA).
3. Select **Apply now**, optionally write a cover note (up to 1,000 characters) and **Submit application**. If your
   profile has a resume, its name is attached automatically; a resume is not required.
4. You cannot apply twice, to an expired job or when you are not eligible — the page tells you why.

### Save jobs
- Select **♡ Save** on a job card or on the job page; it turns into **♥ Saved**. Select it again to unsave.
- **Saved Jobs** lists them (newest first). Jobs that were later closed or removed stay listed with a note so you
  can remove them.

### Track applications
1. Open **My Applications**.
2. Filter by status (Applied, Under Review, Shortlisted, Interview, Selected, Rejected, Withdrawn).
3. Open **View timeline** on an application to see every status change.
4. **Withdraw** is available while the application is *Applied* or *Under Review*. It asks for confirmation and
   cannot be undone; you cannot apply to that job again.

### Profile and resume
1. Open **Profile & Resume**. The completeness bar shows what is still missing (15 items).
2. Use the tabs **Personal**, **Education**, **Skills**, **Projects & Links** and **Resume**. Each tab has its own
   **Save changes**. Your email is your login ID and cannot be changed.
3. **Resume tab:** upload a PDF of up to 500 KB (**Upload resume** / **Replace resume**), view, download or remove
   it, or use **Print resume** to print a resume generated from your profile (A4).

### Dashboard
Shows your application count, shortlisted count, saved jobs, profile completeness, recent applications, recent
notifications, recommended jobs (matched to your skills) and a chart of how many of your applications are in each
status.

## 3. Recruiter

### Before approval
New recruiter accounts are **pending**. You can log in and edit your **Company Profile**, but a banner explains
that posting jobs and viewing applicants unlock once an admin approves your account. You get a notification when
that happens.

### Post and manage jobs
1. Open **Post a Job** and fill in the sections (basics, pay, description, skills, eligibility). Leave both pay
   amounts empty for "Not disclosed"; internships use a monthly stipend.
2. Select **Preview job**, check it, then submit. New jobs are **Pending** until the admin approves them; you are
   notified of the decision (a rejection includes the reason).
3. **My Jobs** lists your jobs with a status filter and applicant counts.
   - **Edit** a pending or approved job. Changing the title, description, eligibility or pay of an approved job
     sends it back to *Pending*.
   - **Close** an approved job to stop new applications (asks for confirmation; applications are kept).

### Review applicants
1. On **My Jobs**, choose **Applicants** for a job (or a name under *Recent applicants* on the dashboard).
2. **View profile** opens the candidate's details, cover note, status history, profile and resume
   (view / download).
3. Choose the next status in **Move to…** and select **Update**. The flow is
   Applied → Under Review → Shortlisted → Interview → Selected, and *Rejected* is possible at any step.
   *Selected* and *Rejected* ask for confirmation and are final. The student is notified.

### Dashboard
Active jobs, total applicants, shortlisted and pending-approval counts, recent applicants, an **Applicants per
job** chart and an **Application funnel** (how many applications reached each stage).

## 4. Admin

### Dashboard
Totals (students, recruiters, jobs, applications), jobs by status, and lists of recruiters and jobs waiting for
approval with **Review all** links. The **Danger zone** has **Reset demo data**, which restores the original demo
data after a confirmation (you stay logged in).

### Users
Search by name, email or company and filter by role and status.
- Pending recruiter: **Approve** or **Delete**.
- Active account: **Block** or **Delete**. Blocked account: **Unblock** or **Delete**.
- Admin accounts have no actions. Block and Delete ask for confirmation; deleting removes the account and its
  related data.

### Moderate Jobs
Filter by status and **View** a job's full details. Pending jobs can be **Approved** or **Rejected** (a reason of
up to 300 characters is required); any job can be **Deleted** after confirmation. Approved jobs appear to
students immediately.

### Announcements
Choose the audience (all users, all students or all recruiters), write a title and message, confirm and send.
Every recipient gets a notification; sent announcements are listed on the page.

### Reports
Four reports — users by role, jobs by status, applications by status and applications over time — each with a
chart, a text summary, a table and **Export CSV** (opens in any spreadsheet program).

## 5. Tips and troubleshooting

| Problem | What to do |
|---|---|
| Blank page or errors when opening the file directly | Serve the folder with a static server (e.g. Live Server); browsers block modules on `file://`. |
| "Browser storage is full" | Remove or replace large resumes, or reset the demo data. |
| Want the original demo data back | Admin → Dashboard → **Reset demo data**, or clear the site's data in the browser. |
| Logged out after closing the tab | Expected: the session is stored per tab in `sessionStorage`. |
