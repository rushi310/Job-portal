# Deploying FreshHire on Vercel

One Vercel project serves **both** parts on one domain:

```
https://your-project.vercel.app/            → the pages   (static files: index.html, pages/, assets/)
https://your-project.vercel.app/api/...     → the API     (the Express app as one Vercel Function)
                                               └→ MongoDB Atlas
```

> **Nothing has been deployed.** The repository is prepared and was checked on this computer against a
> stand-in for Vercel's routing, but it has never been built or run on Vercel itself, and the app has not
> yet connected to your Atlas cluster (Atlas refused the connection from the development computer — see
> §1.3). Treat §5 as the real test.
>
> Free plans change. Check Vercel's and Atlas's pricing pages; do not add a payment card or pick a paid
> plan unless you mean to. Vercel's free "Hobby" plan is for personal, non-commercial use.

**Secrets.** The database connection string, `JWT_SECRET` and the admin password are typed only into
the Vercel dashboard, the Atlas dashboard, your own terminal and `server/.env` (ignored by Git). Never
put them in chat tools, screenshots, commits or frontend files.

*(The earlier split-hosting set-up — pages on Netlify, API on Render — is still supported and is
described in [DEPLOYMENT_NETLIFY_RENDER.md](DEPLOYMENT_NETLIFY_RENDER.md). Use one or the other.)*

## What is already in the repository

| File | What it does on Vercel |
|---|---|
| [`api/index.js`](api/index.js) | The Vercel Function: wraps the existing Express app from `server/src/app.js`, connects to MongoDB on the first request and reuses the connection. No `listen()`. |
| [`vercel.json`](vercel.json) | "Other" preset (no framework); build = copy `index.html`, `assets/`, `pages/` into `public/`; output `public`; `/api/*` → the function; security headers for the pages; 30 s function limit; bundles `data/` for the demo reset. |
| [`package.json`](package.json), `package-lock.json` (root) | Lets Vercel install the API's dependencies from the project root. Same dependency list as `server/package.json` (a test keeps them equal). |
| [`assets/js/core/app-config.js`](assets/js/core/app-config.js) | The pages call the relative address `/api` — the same domain, no setting to edit. |
| [`server/.env.example`](server/.env.example), [`.gitignore`](.gitignore) | Variable list with placeholders; `.env`, `node_modules`, `.vercel`, `public/` ignored. |

There is no rewrite to `index.html`: every page is a real `.html` file and keeps its address. Only
`/api/*` goes to the function. `server/`, `data/`, the documents and `package.json` are not published.

---

## 1. MongoDB Atlas — you do

1. **Cluster and user.** You already have a cluster (`cluster0…`) and a database user. If not: create
   a **free (M0)** cluster, then *Security → Database Access → Add New Database User* with role
   *Read and write to any database*.
2. **Change the database password now.** The current one was pasted into a chat, so treat it as
   exposed: *Database Access → Edit → Edit Password → Autogenerate Secure Password → Update User*. Copy
   the new password into a password manager.
3. **Network access.** *Security → Network Access → Add IP Address*:
   - **Allow Access From Anywhere (`0.0.0.0/0`)** — required for Vercel on the free plan, because
     Vercel Functions connect from changing addresses (fixed addresses are a paid Vercel feature). The
     consequence: any computer on the internet may *attempt* to connect, so the database is protected
     only by its username and password. Keep the long generated password, never reuse it, and give
     this database user access to nothing else.
   - This rule also lets your own computer connect (needed for step 2), which it currently cannot.
4. **Connection string.** *Database → Connect → Drivers*, copy the string and
   - put the new password in place of `<db_password>`,
   - add the database name `freshhire` before the `?`:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/freshhire?retryWrites=true&w=majority&appName=Cluster0
   ```

   This is `MONGODB_URI`.

## 2. Load the demo data — you do (once, from your computer)

1. Open `server/.env` (it already exists on this computer and is ignored by Git) and update the
   `MONGODB_URI` line with the new password. Do not commit this file.
2. In a terminal:

   PowerShell
   ```powershell
   cd server
   $env:SEED_ADMIN_PASSWORD = "type-your-own-admin-password"
   npm run seed
   Remove-Item Env:SEED_ADMIN_PASSWORD
   ```
   Git Bash / macOS / Linux
   ```bash
   cd server
   SEED_ADMIN_PASSWORD='type-your-own-admin-password' npm run seed
   ```

   The admin password must have 12+ characters with upper-case, lower-case and a digit. The script
   refuses to seed a remote database without it, because the demo admin password is public.
3. Expected: `users 11 / 0 / 0`, `jobs 20 / 0 / 0`, `applications 15 / 0 / 0`,
   `notifications 9 / 0 / 0`. Running it again adds nothing and changes nothing.
4. Check locally: `npm run dev`, then <http://localhost:5000/api/health> must show
   `"database":"connected"`, and <http://localhost:5000/> must let you log in.

If the seed says *Could not connect to MongoDB*, the network rule (1.3) is not active yet or the
password in `MONGODB_URI` is wrong.

## 3. Push the code — you do

```bash
git status            # server/.env, node_modules, public/ must NOT be listed
git add -A
git commit -m "Prepare single-project Vercel deployment"
git push
```

## 4. Vercel — you do

1. Sign in at <https://vercel.com/> with GitHub → **Add New… → Project** → import
   `rushi310/Job-portal`.
2. **Project settings** on the import screen (all but the environment variables come from
   `vercel.json`; just confirm them):

   | Setting | Value |
   |---|---|
   | Framework Preset | **Other** |
   | Root Directory | `./` (the repository root — not `server`) |
   | Build Command | `rm -rf public && mkdir public && cp -r index.html assets pages public/` |
   | Output Directory | `public` |
   | Install Command | default (`npm install`) |
   | Node.js Version (Settings → Build and Deployment) | 22.x or 24.x |

3. **Environment Variables** (add for *Production* and *Preview*):

   | Key | Value | Required |
   |---|---|---|
   | `MONGODB_URI` | the Atlas string from step 1.4 | yes |
   | `JWT_SECRET` | a long random value — run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the output | yes (32+ characters) |
   | `NODEJS_HELPERS` | `0` | recommended — hands Express the untouched request, exactly as on your computer |
   | `JWT_EXPIRES_IN` | `2h` | optional (default `2h`) |
   | `APP_TIMEZONE_OFFSET_MINUTES` | `330` | optional (default India time) |
   | `ALLOW_DEMO_RESET` | `false` | optional — `true` lets an admin erase the database |

   Do **not** set `FRONTEND_URL`: pages and API share one domain, so no other site is allowed to call
   the API. Do not set `PORT`, `SERVE_FRONTEND` or `NODE_ENV` (Vercel sets production itself).
   Mark `MONGODB_URI` and `JWT_SECRET` as *Sensitive* if the dashboard offers it.
4. **Deploy.** When it finishes, open the deployment address.

Later pushes to `master` redeploy automatically. After changing an environment variable, redeploy
(*Deployments → … → Redeploy*) — running deployments keep the old values.

## 5. Verify the live site — you do

Not covered by the project's tests; tick these off on the real address.

- [ ] `https://<project>.vercel.app/api/health` → `{"ok":true,"data":{"status":"ok","database":"connected"}}`
- [ ] `https://<project>.vercel.app/` shows job numbers and six jobs.
- [ ] `…/pages/auth/login.html` opens directly (nested pages work), with styling and no missing files
      in the browser's Network tab.
- [ ] Log in as `student@freshhire.com` / `Student@123`: dashboard, search with a filter, save a job,
      apply, withdraw.
- [ ] Reload and log in again: the changes are still there.
- [ ] Log in as `recruiter@freshhire.com` / `Recruiter@123`: post a job → it is *Pending*; open an
      applicants page; change a status.
- [ ] Log in as `admin@freshhire.com` with **your** admin password: approve the job, open Users and
      Reports, send an announcement.
- [ ] As the student, upload a small PDF resume; *View* and *Download* it; open it as the recruiter.
- [ ] Register a new account and log in.
- [ ] In a private window open `…/pages/admin/dashboard.html` → you are sent to the login page.
- [ ] `…/api/admin/users` in the address bar → a JSON "Please log in" answer, not a page.
- [ ] `…/server/src/app.js` and `…/data/users.json` → 404.
- [ ] F12 → Console: no red errors about *Content Security Policy* or failed files.

## 6. Limits to know (Vercel Hobby + Atlas free)

| Topic | What to expect | Effect here |
|---|---|---|
| Cold starts | A function instance that has not been used recently takes a moment to start and to connect to MongoDB | The first request after a pause is slower; the pages show "The server is waking up…" if it exceeds 4 s |
| Instances | Vercel starts and stops instances as it likes; each has its own memory | The login rate limit (20 failed attempts / 15 min per address) is counted per instance, so it is weaker than on one long-running server |
| Request size | About 4.5 MB per request body | Far above the app's own limits (100 KB JSON, 500 KB resume) |
| Duration | `vercel.json` allows 30 s per request | Normal requests take well under a second |
| Database addresses | No fixed outgoing address on the free plan | Atlas must allow `0.0.0.0/0` (see 1.3) |
| Atlas free cluster | 512 MB, shared, no backups, limited connections | Fine for a demo; resumes (≤ 500 KB each) live in it |
| Usage allowances | Monthly limits on function use and bandwidth; a Hobby project is paused when they run out, not billed | A college demo is far below them |

## 7. Troubleshooting

| What you see | Likely cause and fix |
|---|---|
| Build fails: `cp: cannot stat 'index.html'` | Root Directory is not the repository root. Set it to `./`. |
| Build fails or pages 404, and the log mentions an Express entry point | The framework preset was changed; it must be **Other** (`"framework": null` in `vercel.json`). |
| `/api/health` → `"database":"disconnected"` (503) | Atlas network access does not allow `0.0.0.0/0`, the cluster is paused, or `MONGODB_URI` is wrong. Check the function's logs: *Could not connect to MongoDB*. |
| Function log: `bad auth` / `Authentication failed` | Wrong user or password in `MONGODB_URI`, or special characters that need URL-encoding. |
| Every `/api/...` answers *"The server is not configured correctly."* | A required variable is missing or `JWT_SECRET` is shorter than 32 characters. The function log names it. Fix and redeploy. |
| `/api/...` returns `Cannot find module 'express'` | Dependencies were not installed from the root: keep the root `package.json` / `package-lock.json` and the default install command. |
| Pages load without styles | A file is missing from the deployment: check that `assets/` and `pages/` are committed. |
| Demo logins fail | The seed was run against another database name than the one in Vercel's `MONGODB_URI` (`/freshhire`), or not at all (step 2). |
| A request body is rejected oddly (e.g. a 500 for malformed JSON) | `NODEJS_HELPERS=0` is not set (step 4.3). |
| Admin "Reset demo data" is greyed out | Intended: `ALLOW_DEMO_RESET` is not `true`. |
| Preview deployment asks for a Vercel login | Vercel's *Deployment Protection* for previews; the production address is public. |

## 8. Running locally (unchanged)

```bash
cd server
npm install
npm run dev            # API + pages at http://localhost:5000/  (uses server/.env; SERVE_FRONTEND=true)
```

- Pages only, from VS Code **Live Server** (port 5500): they call the API on port 5000 automatically.
- No database at hand: `npm run dev:memory` (temporary data).
- Tests: `npm test`.

The same commands also work from the repository root (`npm run dev`, `npm test`, `npm run seed`); they
just forward to `server/`. `vercel dev` is not needed and was not tested.
