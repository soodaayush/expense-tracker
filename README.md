# Bill Tracker

A personal bill/expense tracker — a spreadsheet replacement with a spreadsheet-like editable grid, CSV import for migrating existing data, and **passkey-only login** (no passwords). Built to run on Azure for close to $0/month.

- **Frontend**: React + TypeScript (Vite SPA), TanStack Table/Query
- **Backend**: Azure Functions v4 (Node + TypeScript), deployed as Azure Static Web Apps "managed functions"
- **Storage**: Azure Table Storage
- **Auth**: WebAuthn passkeys via `@simplewebauthn`, self-issued signed session cookie — no third-party auth vendor

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
- This project has only been run/verified on Windows so far; the code itself is plain Node.js/TypeScript with no OS-specific APIs, but if you hit anything platform-specific on macOS/Linux (tooling install quirks, path issues), it's worth a quick sanity check the first time through.

### First-time setup

```bash
npm install --prefix frontend
npm install --prefix api
npm install   # installs root dev tools: swa-cli, azurite

cp api/local.settings.json.example api/local.settings.json
```

Edit `api/local.settings.json` and set `SESSION_SECRET` and `SETUP_TOKEN` to any local values (they don't need to be secure for local dev, but keep them non-empty).

### Running

You need two terminals:

```bash
# Terminal 1 — storage emulator
npm run dev:azurite

# Terminal 2 — SPA + API behind a single unified origin
npm run dev
```

`npm run dev` starts the Vite dev server and the Functions host together, proxied through `http://localhost:4280`. **Always use port 4280 in the browser**, not 5173 or 7071 directly — WebAuthn's origin check will fail otherwise, since `RP_ID`/`ORIGIN` in `local.settings.json` are configured for `localhost:4280`.

### First login (bootstrap)

There's no public sign-up — the very first passkey is gated by `SETUP_TOKEN`:

1. Visit `http://localhost:4280/login`.
2. Click "First time here? Set up a passkey".
3. Enter the `SETUP_TOKEN` value from `api/local.settings.json`, optionally a device name, and register.
4. Your OS/browser will prompt for a platform authenticator (Windows Hello, Touch ID, security key, etc.).

Once one passkey exists, the setup-token path is permanently disabled (the API checks "0 credentials exist," not the token, as the actual gate) — add further devices from the "Add passkey" button in the app header while already logged in.

### Manual verification checklist

Run through this once locally before considering a change "done" (no automated test suite for this single-user app):

1. Register the first passkey via the bootstrap flow above; confirm you land on `/`.
2. Add a bill row, edit all 5 fields inline (click a cell to edit, Enter/blur to commit, Escape to cancel).
3. Click "Mark paid" on a row, confirm the unpaid total updates.
4. Delete a row (click Delete, then Confirm), reload the page, confirm it's gone.
5. Log out; confirm you're redirected to `/login` and that visiting `/` again redirects back.
6. Log back in with the same passkey (this exercises the login ceremony, not registration).
7. While logged in, click "Add passkey" to register a second device.
8. Go to "Import CSV", upload a small sample file (include at least one blank Amount, one blank Paid Date, and one malformed date), confirm the mapping/preview screen correctly flags the bad row, and that a successful import updates the grid and totals.

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

### 3. Create the Storage Account (Table Storage)

```bash
az storage account create \
  --name <globally-unique-name> \
  --resource-group <your-resource-group> \
  --sku Standard_LRS \
  --kind StorageV2

az storage account show-connection-string \
  --name <globally-unique-name> \
  --resource-group <your-resource-group>
```

At personal-scale row volume (hundreds of rows/year), Table Storage costs a few cents a month.

### 4. Set application settings

These become environment variables for the managed Functions API:

```bash
az staticwebapp appsettings set --name <your-app-name> \
  --setting-names \
    AZURE_STORAGE_CONNECTION_STRING="<connection string from step 3>" \
    SESSION_SECRET="$(openssl rand -base64 32)" \
    SETUP_TOKEN="$(openssl rand -hex 16)" \
    RP_ID="<your-app-name>.azurestaticapps.net" \
    ORIGIN="https://<your-app-name>.azurestaticapps.net"
```

**Important:** if you later attach a custom domain, `RP_ID` and `ORIGIN` must be updated to match it — WebAuthn ties every registered passkey to the RP ID it was created under, so changing it invalidates all existing passkeys. Decide your final domain before registering your first passkey if you can.

### 5. Deploy

Push to the branch connected in step 2 — GitHub Actions builds and deploys automatically.

### 6. Bootstrap your first passkey

Visit `https://<your-app-name>.azurestaticapps.net/login`, use the "first time here" flow with the `SETUP_TOKEN` value from step 4, and register your primary device.

### 7. Retire the setup token

Once a passkey is registered, the bootstrap path is dead regardless of the token (the API only checks whether zero credentials exist). Removing the env var is defense-in-depth cleanup, not strictly required, but recommended so the value isn't sitting in config indefinitely:

```bash
az staticwebapp appsettings delete --name <your-app-name> --setting-names SETUP_TOKEN
```

### 8. Add more devices

While logged in, use "Add passkey" in the app header — no token required, since this path just needs an active session.

### 9. Rotating the session secret

Rotating `SESSION_SECRET` invalidates all active sessions (forces re-login everywhere) but does **not** affect registered passkeys. Safe to do anytime, e.g. if you suspect it's been exposed:

```bash
az staticwebapp appsettings set --name <your-app-name> --setting-names SESSION_SECRET="$(openssl rand -base64 32)"
```

### Expected cost

Static Web Apps Free tier: $0 (includes 100GB/month bandwidth + managed functions). Table Storage at this row volume: roughly $0.05–$0.50/month. Total: well under $1–2/month.

## Migrating your existing spreadsheet

Export your Dropbox spreadsheet to CSV, then use the "Import CSV" screen in the app. It expects (and will try to auto-detect) columns for Payee, Amount, Due Date, Paid Date, and Notes — you can remap them manually if your headers differ. Rows with unparseable dates or amounts are flagged and skipped rather than blocking the whole import.
