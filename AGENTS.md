# AGENTS.md — Token Triangle

Rules for humans and AI agents working on this system. **Procedures:** [`OPERATIONS.md`](./OPERATIONS.md) · **Spec:** [`SPEC.md`](./SPEC.md) · **History & mistakes:** [`CONTEXT.md`](./CONTEXT.md)

---

## What this is

Three **standalone** Google Apps Script projects (`clasp` `rootDir: src` each):

| Project | Role | Deploy |
|---------|------|--------|
| `authenticator/` | Issues short-lived codes; verifies codes (one-time cache) | **Web app** `doGet` / `doPost` on `/exec`; optional **API Executable** for `issueCode` |
| `token-broker/` | `UrlFetch` → authenticator verify; returns `TOKEN_<NAME>` from Script Properties | **Web app** + optional **API Executable** for `getNamedTokens` |
| `sample-caller/` | Reference **`TokenClient.js`** + `runSample()` | Optional — **not** required in production traffic |

**Push with `clasp-cc`** (CC Apps Script account).

---

## Production traffic (non-negotiable)

- **Never rely on `@HEAD` / editor-only saves** for URLs callers use. Use **pinned** Web app deployment IDs: `https://script.google.com/macros/s/<deploymentId>/exec`.
- **`clasp-cc push` does not change what `/exec` runs** until you create a **new version** and **`clasp-cc deploy -i <deploymentId>`** (see OPERATIONS.md).
- Keep a **local** [`scripts/tt-deploy-ids.json`](./scripts/tt-deploy-ids.json) (from [`scripts/tt-deploy-ids.example.json`](./scripts/tt-deploy-ids.example.json)) aligned with **Manage deployments** when you intentionally add or change deployments. The local file is gitignored.

---

## Global entry points (`main.js`)

Google invokes **only top-level** `function doGet` / `function doPost` for web apps. They **must** be **first** in `main.js`, before file-level `const`/`let` that only support those entries. Delegate to `AUTH_APP` / `BROKER_APP` UMD modules.

**Sample caller:** `getPermission()` and `runSample()` at top of `main.js`.

**`getPermission`:** `GET ?action=getPermission` or `POST {"action":"getPermission"}` on deployed web apps; Run menu on sample-caller.

---

## Authenticator verify (critical)

- **POST** body: `{ "action": "verify", "code": "<string>", "internalSecret": "<AUTH_INTERNAL_SECRET>" }`.
- **Headers:** `X-Internal-Secret` (same value) when the platform passes it; **body** is required in practice for published web apps (headers may not reach `event.headers`).
- **Do not** treat OAuth **Bearer** as the internal secret on verify (header-only extraction uses `extractInternalSecretHeaderOnly`).

---

## Token broker

- **`readBrokerConfig`:** `AUTHENTICATOR_BASE_URL` must be **Web** `/exec` — **reject** `script.googleapis.com` URLs with a clear error.
- **`fetchVerifyOutcome`:** JSON body includes `internalSecret`; headers include `X-Internal-Secret`; for `script.google.com` URLs also set **`Authorization: Bearer`** + `ScriptApp.getOAuthToken()` when available.

---

## Reusable client — [`sample-caller/src/TokenClient.js`](./sample-caller/src/TokenClient.js)

Copy into any consumer project (list in `filePushOrder` **before** `main.js`). Requires `script.external_request` in manifest.

### Script Properties (consumer)

| Property | Purpose |
|----------|---------|
| `AUTHENTICATOR_TRANSPORT`, `TOKEN_BROKER_TRANSPORT` | `webapp` or `script_api` |
| `AUTHENTICATOR_URL`, `TOKEN_BROKER_URL` | **webapp:** `https://script.google.com/macros/s/…/exec` only — **not** `…googleapis.com…:run` |
| `CALLER_SECRET` | Must match authenticator `CALLER_SECRET` (issue step) |
| `DEMO_TOKEN_NAMES` | Optional; comma-separated logical names (default `DEMO`) |
| `TOKEN_CLIENT_VERBOSE` | `true` to log every step (or pass `{ verbose: true }` to `fetchNamedTokens`) |

**Validation:** If transport is `webapp` and URL looks like Execution API, **`fetchNamedTokens` throws** before UrlFetch.

### Return value of `fetchNamedTokens(names[, { verbose }])`

```js
{
  httpIssue: number,       // HTTP status from issue step
  httpBroker: number,      // HTTP status from broker (script_api broker path reports 200)
  issued: { expiresInSeconds: number },
  broker: {
    ok: boolean,             // success when true
    tokens: { [name]: string },
    missing: string[]
    // or ok: false, error: string, ...
  }
}
```

**`runSample()`** calls `fetchNamedTokens(..., { verbose: true })` and **`Logger.log`s** start/end and full return JSON — use **Executions** to view.

---

## Smoke tests (`SmokeTest.js`)

- **Not** Jest — **Run menu** in Apps Script; uses **`UrlFetchApp`** against **deployed** URLs and **`console.log`** / **`Logger.log`**.
- **Authenticator:** `smokeTest_runUrlFetch` — issue + verify via Web `/exec`.
- **Broker:** `smokeTest_reachAuthenticator`, `smokeTest_endToEndDeployed`, debug helpers — see `token-broker/src/SmokeTest.js`.
- Broker debug uses **hardcoded** Web `/exec` + plumbing secrets when isolating auth vs props issues.

---

## Local tests (Node)

From repo root: `npm test`.

- [`tests/fixtures/opsProperties.js`](./tests/fixtures/opsProperties.js) — canonical property maps for “operations-shaped” tests.
- [`createRecordingUrlFetchApp`](./tests/vm-fakes/fakeUrlFetchApp.js) — capture UrlFetch URL, headers, payload.
- **`installTokenBrokerGasFakes` / `installSampleCallerGasFakes`** accept a prebuilt **`UrlFetchApp`** object (`.fetch` method) for recording.

---

## UMD module order

Inside `AuthApp.js`, `BrokerApp.js`, `TokenClient.js`: `const`/config → **public API functions** (same order as `return { … }`) → private helpers.

---

## Folder layout

| Path | Files |
|------|--------|
| `authenticator/src/` | `ENV.js`, `Utils.js`, `AuthApp.js`, `SmokeTest.js`, `main.js`, `appsscript.json` |
| `token-broker/src/` | `ENV.js`, `Utils.js`, `BrokerApp.js`, `SmokeTest.js`, `main.js`, `appsscript.json` |
| `sample-caller/src/` | `TokenClient.js`, `main.js`, `appsscript.json` |

---

## Do not

- Put **`doGet`/`doPost`** inside UMD closures only — web deployment will not call them.
- Put **`AUTHENTICATOR_BASE_URL`** or consumer **`AUTHENTICATOR_URL`** (webapp) to **`script.googleapis.com/...:run`**.
- Assume **`clasp push`** updates live **`/exec`** without **`deploy -i`**.
- **Redeploy sample-caller** as part of production pipeline — it is reference-only unless you use that script project.
- **Do not commit** production secrets — set **Script Properties** only in the Apps Script UI (or a private ops vault), not in source files.
