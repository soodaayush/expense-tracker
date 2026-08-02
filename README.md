# Bill Tracker

A multi-tenant bill/expense tracker — a spreadsheet replacement with a spreadsheet-like editable grid, CSV import for migrating existing data, and **passkey-only accounts** (no passwords, no email/username — an account is just a passkey). Anyone can create their own account with open sign-up; each account's bills/payees are completely private and isolated from every other account. Built to run on Azure for close to $0/month.

- **Frontend**: React + TypeScript (Vite SPA), TanStack Table/Query
- **Backend**: Azure Functions v4 (Node + TypeScript), deployed as Azure Static Web Apps "managed functions"
- **Storage**: Azure SQL Database (Always Free serverless tier — genuinely $0, not just cheap), every account-owned table scoped by account id for isolation
- **Auth**: WebAuthn passkeys via `@simplewebauthn`, self-issued signed session cookie — no third-party auth vendor, no email/username collected anywhere

## Project layout

```
frontend/   Vite + React SPA (app_location for SWA)
api/        Azure Functions v4 API (api_location for SWA)
```

`frontend/public/staticwebapp.config.json` is the real SWA routing config — Vite copies it into `frontend/dist/` on every build, which is where SWA expects to find it.

## Local development

### Prerequisites
- **Node.js 20 LTS specifically.** Azure Functions Core Tools v4 does not yet support newer non-LTS Node versions (e.g. 22 odd/24) — if `npm run dev` fails with "Found Azure Functions Core Tools v4 which is incompatible with your current Node.js version," this is why. A `.nvmrc` is included, so any of the tools below will pick up "20" automatically inside the project directory:
  - **Windows**: [nvm-windows / nvm4w](https://github.com/coreybutler/nvm-windows) — `nvm install 20 && nvm use 20`
  - **macOS / Linux**: [nvm](https://github.com/nvm-sh/nvm) — `nvm install && nvm use` (reads `.nvmrc` automatically), or Homebrew (`brew install node@20`), or [`n`](https://github.com/tj/n)
- A platform authenticator for passkeys — Windows Hello, Touch ID/Face ID (macOS), or a security key/phone acting as a roaming authenticator on Linux — or a browser with a virtual authenticator for testing.
- **Docker**, for a local SQL Server container — there's no free emulator for Azure SQL the way Azurite emulates Table Storage, so local dev runs a real SQL Server engine in a container instead.
- This project has only been run/verified on Windows so far; the code itself is plain Node.js/TypeScript with no OS-specific APIs, but if you hit anything platform-specific on macOS/Linux (tooling install quirks, path issues), it's worth a quick sanity check the first time through.

### First-time setup

```bash
npm install --prefix frontend
npm install --prefix api
npm install   # installs root dev tools: swa-cli, azurite, mssql

cp api/local.settings.json.example api/local.settings.json
```

Edit `api/local.settings.json` and set `SESSION_SECRET` to any local value (doesn't need to be secure for local dev, just non-empty) — the `SQL_*` values in the example file already match the Docker container below, no changes needed there for local dev.

### Running

You need three terminals the first time (two after that, until the schema changes):

```bash
# Terminal 1 — Functions host bookkeeping storage emulator (unrelated to app data)
npm run dev:azurite

# Terminal 2 — local SQL Server (first time only, then it just needs to be running)
npm run dev:sql
npm run db:migrate   # applies sql/schema.sql — safe to re-run anytime

# Terminal 3 — SPA + API behind a single unified origin
npm run dev
```

`npm run dev` starts the Vite dev server and the Functions host together, proxied through `http://localhost:4280`. **Always use port 4280 in the browser**, not 5173 or 7071 directly — WebAuthn's origin check will fail otherwise, since `RP_ID`/`ORIGIN` in `local.settings.json` are configured for `localhost:4280`.

`npm run dev:sql:down` stops the SQL container (data persists in its Docker volume — `npm run dev:sql` next time picks up where you left off, no need to re-migrate unless the volume was removed).

**If `npm run db:migrate` fails with "Login failed for user 'sa'"**, and you have a native SQL Server instance already installed on this machine (check Windows Services for `MSSQLSERVER`, or the equivalent on macOS/Linux), it's almost certainly squatting on port 1433 and intercepting the connection before it reaches the container — the login failure is a red herring, not a real password problem. This is why the container maps to host port **14330**, not 1433 (see `sql/docker-compose.yml`); if you've changed that mapping, make sure `SQL_PORT` in `local.settings.json` still matches.

### Creating an account

Sign-up is open — anyone who reaches the site can create their own account. There's no email or username at all; an account is just a passkey:

1. Visit `http://localhost:4280/login`.
2. Click "New here? Create an account".
3. Optionally type a name for the account (shown in your browser/password manager's passkey picker, and in the app header) — this is purely cosmetic, not an identifier.
4. Click "Create account with a passkey"; your OS/browser will prompt for a platform authenticator (Windows Hello, Touch ID, security key, etc.).

That's it — you're logged in immediately, with your own private, empty bill list. Add further devices to the same account from the "Add passkey" button in the app header while logged in.

### Manual verification checklist

Run through this once locally before considering a change "done" (no automated test suite for this app):

1. Create an account via the flow above; confirm you land on `/` with an empty bill list.
2. Add a bill row, edit all 5 fields inline (click a cell to edit, Enter/blur to commit, Escape to cancel).
3. Click "Mark paid" on a row, confirm the unpaid total updates.
4. Delete a row (click Delete, then Confirm), reload the page, confirm it's gone.
5. Log out; confirm you're redirected to `/login` and that visiting `/` again redirects back.
6. Log back in with the same passkey (this exercises the login ceremony, not sign-up).
7. While logged in, click "Add passkey" to register a second device on the same account.
8. **Create a second, separate account** and confirm it sees an empty bill list, not the first account's bills — this is the core isolation guarantee, worth checking after any change touching auth or the data layer.
9. Go to "Import CSV", upload a small sample file (include at least one blank Amount, one blank Paid Date, and one malformed date), confirm the mapping/preview screen correctly flags the bad row, and that a successful import updates the grid and totals.

## Deploying to Azure

This repo does not provision or deploy anything itself — run these steps yourself when ready.

### 1. Prerequisites
- An Azure subscription
- [`az` CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed, logged in (`az login`)
- This code pushed to a GitHub repository

### 2. Create the Static Web App

Via the Portal: **Create a resource → Static Web App → Free plan**, connect your GitHub repo/branch, and set:
- App location: `/frontend`
- Api location: `/api`
- Output location: `dist`

This auto-generates a GitHub Actions workflow and a repo secret that deploys on every push.

Or via CLI:

```bash
az staticwebapp create \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --source https://github.com/<you>/<repo> \
  --branch main \
  --app-location "frontend" \
  --api-location "api" \
  --output-location "dist" \
  --login-with-github
```

### 3. Create the Azure SQL Database (Always Free tier)

```bash
az sql server create \
  --name <globally-unique-server-name> \
  --resource-group <your-resource-group> \
  --location <region> \
  --admin-user <sql-login> \
  --admin-password "<a-strong-password>"

az sql db create \
  --resource-group <your-resource-group> \
  --server <globally-unique-server-name> \
  --name BillTracker \
  --edition GeneralPurpose \
  --family Gen5 \
  --capacity 2 \
  --compute-model Serverless \
  --use-free-limit \
  --free-limit-exhaustion-behavior AutoPause
```

`--use-free-limit` is what makes this genuinely $0 (100K vCore-seconds + 32GB/month, one free database per subscription) — `AutoPause` means it simply pauses rather than starts billing if you ever exceed the free allowance, so there's no surprise-charge risk. The tradeoff: the database pauses after inactivity and the first request after a pause takes several seconds to resume — expected, not a bug.

**Required firewall rule** — Azure SQL blocks all traffic by default, including from Azure's own compute:
```bash
az sql server firewall-rule create --resource-group <your-resource-group> --server <globally-unique-server-name> \
  --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```
(`0.0.0.0`–`0.0.0.0` is Azure SQL's special sentinel for "allow Azure-hosted resources," not a literal open-to-the-world rule.) Skipping this means the deployed app can't reach the database at all, and the error you'll see is a generic connection timeout with no obvious link back to "it's the firewall."

**Apply the schema** — same script used locally, pointed at the real database:
```bash
SQL_SERVER=<globally-unique-server-name>.database.windows.net SQL_DATABASE=BillTracker \
SQL_USER=<sql-login> SQL_PASSWORD="<a-strong-password>" npm run db:migrate
```

### 4. Set application settings

These become environment variables for the managed Functions API:

```bash
az staticwebapp appsettings set --name <your-app-name> \
  --setting-names \
    SQL_SERVER="<globally-unique-server-name>.database.windows.net" \
    SQL_DATABASE="BillTracker" \
    SQL_USER="<sql-login>" \
    SQL_PASSWORD="<a-strong-password>" \
    SESSION_SECRET="$(openssl rand -base64 32)" \
    RP_ID="<your-app-name>.azurestaticapps.net" \
    ORIGIN="https://<your-app-name>.azurestaticapps.net"
```

Note `SQL_TRUST_SERVER_CERT` is deliberately **not** set here — it should only ever be `"true"` for local Docker dev (a self-signed cert); left unset, the app correctly requires Azure SQL's real, CA-trusted certificate.

**Important:** if you later attach a custom domain, `RP_ID` and `ORIGIN` must be updated to match it — WebAuthn ties every registered passkey to the RP ID it was created under, so changing it invalidates all existing passkeys. Decide your final domain before registering your first passkey if you can.

### 5. Deploy

Push to the branch connected in step 2 — GitHub Actions builds and deploys automatically.

### 6. Create your account

Visit `https://<your-app-name>.azurestaticapps.net/login` and use "New here? Create an account" — no token, invite, or credential needed, sign-up is open to anyone who reaches the URL. This also means anyone else who finds the URL can create their own (separate, isolated) account — that's expected given the open-signup design (see "Security notes" below).

### 7. Add more devices

While logged in, use "Add passkey" in the app header to register another device on the same account.

### 8. Rotating the session secret

Rotating `SESSION_SECRET` invalidates all active sessions (forces re-login everywhere) but does **not** affect registered passkeys. Safe to do anytime, e.g. if you suspect it's been exposed:

```bash
az staticwebapp appsettings set --name <your-app-name> --setting-names SESSION_SECRET="$(openssl rand -base64 32)"
```

### Expected cost

Static Web Apps Free tier: $0 (includes 100GB/month bandwidth + managed functions). Azure SQL Database on the free-limit serverless tier: $0, as long as usage stays under 100K vCore-seconds + 32GB/month — extremely unlikely to exceed at personal-app scale, and `AutoPause` means it pauses rather than bills if you ever did. Total: genuinely $0/month, not just cheap.

### Security notes

- **Sign-up is open and unauthenticated** — anyone with the URL can create an account. There's no email verification or invite gate. This is a deliberate tradeoff: each account's data is fully isolated (see below), so open sign-up's realistic exposure is nuisance accounts/storage cost, not one account reading another's data.
- **Data isolation is enforced by every query, not just Table Storage's addressing model anymore**: bills and payees are stored in Azure SQL with every row scoped to an account id, and every query includes `WHERE user_id = @userId` sourced only from the signed session — never from a request body/param. A request for another account's bill id simply matches zero rows (a clean 404) rather than ever returning data. This is disciplined application code enforcing the boundary (via a consistent, audited pattern across every query), not a storage-engine-level guarantee the way Table Storage's partition addressing was — worth knowing if you ever add a new query against these tables.
- **No rate limiting** on account creation. Deferred deliberately — each sign-up requires a real WebAuthn ceremony (a physical authenticator), which already blocks naive scripted mass-account creation. Add rate limiting later if it ever becomes a real problem.
- **Accounts have no recovery mechanism.** Since there's no email, losing access to every registered passkey for an account means losing access to that account's data permanently — there's no password reset or account recovery flow. Registering a passkey on more than one device ("Add passkey") is the only mitigation.
- **The free tier auto-pauses on inactivity** — the first request after a pause can take several seconds to resume. Expected behavior, not a bug; not worth engineering around with a keep-alive ping (that would just burn the free vCore-second allowance for no real benefit).

## Staging environment

For testing changes (schema migrations, new features) without touching production data, run staging as a **second, fully separate Static Web App** connected to a `staging` branch — not SWA's built-in PR/branch preview environments, which share app settings with production and are ephemeral. The two deployments never share config or data.

### 1. Create a second Static Web App

Portal: **Create a resource → Static Web App → Free plan**, connect the same GitHub repo, branch = `staging`, same locations as prod (App `/frontend`, Api `/api`, Output `dist`). This auto-generates a second GitHub Actions workflow file and a second repo secret, the same way the existing prod workflow was created — pushes to `staging` now deploy independently from pushes to `main`.

### 2. Create a second database

Reuse the existing SQL logical server (same admin login, same `AllowAzureServices` firewall rule already covers it) rather than standing up a second server:

```bash
az sql db create \
  --resource-group <your-resource-group> \
  --server <your-existing-sql-server> \
  --name BillTrackerStaging \
  --edition GeneralPurpose \
  --family Gen5 \
  --capacity 2 \
  --compute-model Serverless
```

Note there's no `--use-free-limit` here — Azure only grants the Always-Free allowance to one database per subscription, and the prod database already claims it. A second database is a small real cost (roughly a few dollars a month at low usage), so total spend is no longer strictly $0 once staging exists.

Apply the schema the same way as prod, pointed at the new database:

```bash
SQL_SERVER=<your-existing-sql-server>.database.windows.net SQL_DATABASE=BillTrackerStaging \
SQL_USER=<sql-login> SQL_PASSWORD="<same-password-as-prod>" npm run db:migrate
```

### 3. Set application settings on the staging resource

```bash
az staticwebapp appsettings set --name <your-staging-app-name> \
  --setting-names \
    SQL_SERVER="<your-existing-sql-server>.database.windows.net" \
    SQL_DATABASE="BillTrackerStaging" \
    SQL_USER="<sql-login>" \
    SQL_PASSWORD="<same-password-as-prod>" \
    SESSION_SECRET="$(openssl rand -base64 32)" \
    RP_ID="<your-staging-app-name>.azurestaticapps.net" \
    ORIGIN="https://<your-staging-app-name>.azurestaticapps.net"
```

`SESSION_SECRET` should be a fresh value, independent from prod's.

**Passkeys don't carry over between environments.** WebAuthn ties every registered passkey to the `RP_ID` it was created under, and staging's `RP_ID` is necessarily different from prod's — so staging gets its own, separate accounts. This is actually what you want (a safe sandbox with test data, isolated from real accounts), just worth knowing going in: signing up on staging doesn't give you access on prod or vice versa.

### 4. Deploy and verify

Push to `staging` to trigger the new workflow. Visit the staging URL, create a test account, and confirm bills you add there land in `BillTrackerStaging`, not the production database.

## Migrating your existing spreadsheet

Export your Dropbox spreadsheet to CSV, then use the "Import CSV" screen in the app. It expects (and will try to auto-detect) columns for Payee, Amount, Due Date, Paid Date, and Notes — you can remap them manually if your headers differ. Rows with unparseable dates or amounts are flagged and skipped rather than blocking the whole import.
