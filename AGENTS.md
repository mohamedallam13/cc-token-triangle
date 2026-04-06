# AGENTS.md — Token Triangle (GAS)

Rules for humans and AI agents working on or **consuming** this system in Google Apps Script.

**Context, procedures, lessons learned:** [`OPERATIONS.md`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/OPERATIONS.md).

## What this is

Three standalone Apps Script projects (clasp `rootDir: src` each):

| Project | Role | Web app? |
|---------|------|----------|
| `authenticator/` | Issues short-lived codes; verifies codes for the broker | **Yes** — deploy `doGet` / `doPost` |
| `token-broker/` | Verifies code with Authenticator; returns `TOKEN_*` from Script Properties | **Yes** — deploy `doGet` / `doPost` |
| `sample-caller/` | Demo + **reusable client file** | Usually **no** — library / automation script |

Account: **`theoracle@cairoconfessions.com`**, push with **`clasp-cc`**.

## Deployments: versioned web apps only (not HEAD)

- **Production traffic never uses the editor “latest” / `@HEAD` snapshot.** Integrations and Script Properties must point at **fixed** web app deployment IDs (`https://script.google.com/macros/s/<deploymentId>/exec`). Each deployment is pinned to an **immutable version** (`@1`, `@2`, … — see `clasp-cc deployments`).
- **`clasp-cc push` alone does not update what `/exec` runs** until you **`clasp-cc version "…"`** (new snapshot) and **`clasp-cc deploy -i <deploymentId> -V <thatVersion> -d "…"`** on the existing deployment. Keep deployment ids in [`scripts/tt-deploy-ids.json`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/scripts/tt-deploy-ids.json); update that file only if you intentionally create a **new** web app deployment (new URL).
- **Agents:** assume this model by default — never tell operators to rely on HEAD for live Token Triangle behavior.

## Critical: global entry points (web apps)

Google only invokes **top-level** `function doGet(e)` / `function doPost(e)` on the deployed script. They **must** live in `main.js` **outside** any UMD closure.

- **Placement:** In every `main.js`, put **all** global entry functions **first** — at the top of the file, before any file-level `const` / `let` that only supports those entries. Examples: Authenticator/broker: `doGet` then `doPost`. Sample caller: `getPermission()` then `runSample()` at top; token name lists live **inside** `runSample`. No hunting through the file for “where is main?”.

- **Do not** hide `doGet` / `doPost` inside `AUTH_APP` only — the file [`authenticator/src/main.js`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/authenticator/src/main.js) and [`token-broker/src/main.js`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/token-broker/src/main.js) are **only** those globals delegating to `AUTH_APP` / `BROKER_APP`.

- Consumer scripts that use the Run menu need **top-level** functions — **first** in the file (e.g. [`sample-caller/src/main.js`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/sample-caller/src/main.js): `getPermission` then `runSample`; wanted token names are **inside** `runSample`).

### `getPermission` (all three scripts)

Returns JSON: `service`, `scriptId`, `authStatus` (from `ScriptApp.getAuthorizationInfo`), `oauthScopes` (declared in `ENV` / inline for sample — keep aligned with `appsscript.json` when you add `oauthScopes` there).

- **Authenticator & Token broker (deployed web apps):** `GET ?action=getPermission` or `POST` body `{"action":"getPermission"}`.
- **Sample caller:** Run **`getPermission`** from the IDE (no web app required).

## Reusable client (copy into every project that needs tokens)

**Canonical file:** [`sample-caller/src/TokenClient.js`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/sample-caller/src/TokenClient.js)

1. Add that file to the consumer Apps Script project (same content; push with clasp after `filePushOrder` lists `TokenClient.js` **before** `main.js`).
2. `appsscript.json` must include `https://www.googleapis.com/auth/script.external_request` (UrlFetchApp).
3. Set **Script Properties** on the **consumer** project:
   - `AUTHENTICATOR_URL` — full Authenticator web app URL (`…/exec`)
   - `TOKEN_BROKER_URL` — full Token broker web app URL (`…/exec`)
   - `DEMO_TOKEN_NAMES` (optional) — comma-separated token **logical names** (e.g. `DEMO,MY_API`). Broker must define matching `TOKEN_DEMO`, `TOKEN_MY_API`, etc.

4. From code, call `TOKEN_CLIENT.fetchNamedTokens(['KEY1','KEY2'])` with the logical names you need. Optional: `TOKEN_CLIENT.fetchNamedTokensFromProperties()` reads comma-separated names from `DEMO_TOKEN_NAMES` (default `DEMO`) if you prefer properties-driven lists.

5. The sample [`main.js`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/sample-caller/src/main.js) defines **`SAMPLE_WANTED_TOKENS` inside `runSample`** and passes it to `fetchNamedTokens` — copy that pattern: main owns the list, not Script Properties.

## Deploy order (new environment)

1. **Authenticator & Token broker:** `appsscript.json` includes **`webapp`** only (no `executionApi` — production is **web app** deployments with `/exec`, not API executable). Use **`access`: `DOMAIN`** (same Google Workspace as the deployer — CC / **`theoracle@cairoconfessions.com`**), **`executeAs`: `USER_DEPLOYING`**. Follow **Deployments: versioned web apps only** above: `clasp-cc push` → `clasp-cc version "…"` → `clasp-cc deploy -i <deploymentId> -V <version> -d "…"` using ids in [`scripts/tt-deploy-ids.json`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/scripts/tt-deploy-ids.json). Web app URL: `https://script.google.com/macros/s/<deploymentId>/exec`.
2. **Temporary setup (remove later):** `export TT_AUTH_INTERNAL_SECRET=…` (and optional `TT_TOKEN_DEMO`), then `npm run setup:urls` → writes [`scripts/generated/tt-manual-script-properties.md`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/scripts/generated/tt-manual-script-properties.md) (gitignored) for pasting into Script properties. Optionally run `_ttSetup*` from the IDE (functions in [`SetupTemp.js`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/authenticator/src/SetupTemp.js)) — **no** API executable or `clasp run`. Delete `SetupTemp.js`, strip it from `.clasp.json` `filePushOrder`, and remove `scripts/tt-setup-deploy-urls.mjs` + `scripts/tt-deploy-ids.json` when done.
3. **Property semantics:** Authenticator: `AUTH_INTERNAL_SECRET`. Token broker: `AUTHENTICATOR_BASE_URL` (Authenticator `/exec` URL), same `AUTH_INTERNAL_SECRET`, `TOKEN_<NAME>` for each logical name. Sample caller: `AUTHENTICATOR_URL`, `TOKEN_BROKER_URL`.
4. Run `runSample()` or your wrapper on the consumer.

## Local tests (Node)

From [`Token Triangle/`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/): `npm install` / `npm test`.

- **`@mcpher/gas-fakes`** — loaded once via [`tests/bootstrapGasFakes.js`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/tests/bootstrapGasFakes.js) + [`tests/jest.setup.js`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/tests/jest.setup.js) so `globalThis.Utilities`, `globalThis.Logger`, etc. match Apps Script behavior. Requires [`gasfakes.json`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/gasfakes.json) at the project root (cache/properties paths under `/tmp/gas-fakes/token-triangle/`). `npm test` sets `NODE_OPTIONS='--experimental-vm-modules'` so the ESM entry can load under Jest.
- **`vm` + [`tests/vm-fakes/`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/tests/vm-fakes/)** — injects GAS-like APIs into a sandbox for each test: in-memory **PropertiesService** / **CacheService** (isolated per test), **ContentService** (no equivalent in gas-fakes), **UrlFetchApp** stubs for broker/caller. Copies **Utilities** / **Logger** from gas-fakes into the sandbox where needed.

## UMD module layout (`TokenClient.js`, `AuthApp.js`, `BrokerApp.js`, `Utils.js`, …)

Inside each `factory()`:

1. **`const` / config** first (property keys, limits).
2. **Exported / public functions next** — the functions named in the final `return { … }`, in the **same order** as the return object (or the “main” API first: e.g. `fetchNamedTokens`, `fetchNamedTokensFromProperties`, `parseCommaNames` in `TokenClient.js`).
3. **Private helpers last** (e.g. `postJson` in `TokenClient.js`; `jsonOutput`, `routeIssue`, … in `AuthApp.js`). Hoisted `function` declarations allow mains to call helpers defined below.

So opening a file shows the real API immediately, not only at the bottom `return`.

## `main.js` layout (mandatory)

1. Put **all** global entry functions (`doGet`, `doPost`, `getPermission`, `runSample`, …) at the **start** of `main.js`.
2. Put file-level **`const` / `let`** that only support those entries **after** the entry functions — **unless** the values are only used inside one entry (then keep them **inside** that function; sample caller does this for `SAMPLE_WANTED_TOKENS`).
3. If there are several mains (multiple Run-menu handlers), keep them in **one block at the top** — still before any file-level supporting constants.

## Layout (after simplification)

| Path | Contents |
|------|----------|
| `authenticator/src/` | `ENV.js`, `Utils.js`, `AuthApp.js`, `SetupTemp.js` (remove later), `main.js`, `appsscript.json` |
| `token-broker/src/` | `ENV.js`, `Utils.js`, `BrokerApp.js`, `SetupTemp.js` (remove later), `main.js`, `appsscript.json` |
| `sample-caller/src/` | `TokenClient.js`, `SetupTemp.js` (remove later), `main.js`, `appsscript.json` |

## Do not

- Put file-level supporting constants **above** global entry functions in `main.js` — entry functions must stay at the top (see **Placement** and **`main.js` layout**). Constants used only inside one entry belong **inside** that function.
- Treat **HEAD** / editor-only saves as sufficient for production URLs — always **version + redeploy** (see **Deployments: versioned web apps only**).
- Remove or rename global `doGet` / `doPost` on Authenticator or Token broker without updating deployment.
- Log real token values in production (sample uses `Logger` for demo only).
