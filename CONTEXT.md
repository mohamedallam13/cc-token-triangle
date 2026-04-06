# Token Triangle — Context & history

Narrative companion to [`OPERATIONS.md`](./OPERATIONS.md) and [`SPEC.md`](./SPEC.md). **Why things are the way they are** (including mistakes and fixes) lives here.

---

## What this system is (one paragraph)

**Token Triangle** lets Google Apps Script projects obtain **named API secrets** (stored only on the **token broker**) by proving they completed a **short-lived challenge** from the **authenticator**. The consumer never sees the broker’s internal verification secret; it only calls two HTTP endpoints (`/exec` web apps or, optionally, the Apps Script Execution API). Cairo Confessions uses **`theoracle@cairoconfessions.com`** and **`clasp-cc`** for pushes.

---

## Chronology (high level)

| Phase | What happened |
|--------|----------------|
| **Initial design** | Three clasp projects under `apps/` (authenticator, token-broker, sample-caller) + `TokenClient.js` UMD module. Web app `doGet`/`doPost` as global entry points. |
| **Deployment model** | Pinned **Web app** deployment IDs → `https://script.google.com/macros/s/<id>/exec`. Local `tt-deploy-ids.json` (from example) tracks ids; **push ≠ live** until `clasp version` + `clasp deploy -i <deploymentId>`. |
| **Smoke & debugging** | UrlFetch-based smoke tests in `SmokeTest.js` (not Jest pretending to be GAS). Hardcoded API `:run` URL for issue; discovered **Web vs API URL confusion** and **custom header visibility** on published web apps. |
| **Authenticator verify fix** | Published web apps often **do not expose** `X-Internal-Secret` on `event.headers`. **Fix:** accept **`internalSecret` in JSON body** for `action: verify`; still send header when the runtime passes it through. |
| **Broker** | `fetchVerifyOutcome` sends **body + header**; adds **Bearer** for `script.google.com` URLs (same idea as `TokenClient.postJson`). Rejects `script.googleapis.com` in `AUTHENTICATOR_BASE_URL`. |
| **Client (`TokenClient.js`)** | **`assertWebTransportEndpoints`**: if transport is `webapp`, reject `script.googleapis.com` URLs (fail fast with a clear error). **`TOKEN_CLIENT_VERBOSE`** / `{ verbose: true }` step logging; **`runSample`** enables verbose by default. |
| **Tests (Node)** | `tests/fixtures/opsProperties.js` canonical props; **`createRecordingUrlFetchApp`** records UrlFetch calls; broker tests assert **verify payload** shape; sample-caller tests assert **two-step client** (issue → getToken). |

---

## Mistakes we hit (and what was wrong)

1. **`AUTHENTICATOR_BASE_URL` / `AUTHENTICATOR_URL` set to `script.googleapis.com/.../scripts/...:run`**  
   **Symptom:** 401 `CREDENTIALS_MISSING` or 400 “Unknown name `action`”.  
   **Cause:** That host is the **Execution API**, not the **Web app** `doPost`. The broker and webapp client send `{ action: verify }` / `{ action: issue }` — wrong envelope for `:run`.  
   **Fix:** Use **Web app** URL: `https://script.google.com/macros/s/<webDeploymentId>/exec`. API Executable id ≠ Web deployment id (see local `tt-deploy-ids.json`).

2. **Custom headers “missing” on verify**  
   **Symptom:** `Invalid or missing internal secret` even when broker property matched.  
   **Cause:** GAS web app **`doPost`** may not surface `X-Internal-Secret` in `event.headers` reliably.  
   **Fix:** **`internalSecret` in JSON body** on verify; authenticator reads header **or** body (header-only extraction for verify does **not** treat OAuth Bearer as secret).

3. **Smoke test: verify twice with one code**  
   **Symptom:** Second request `Invalid or expired code`.  
   **Cause:** Codes are **single-use** (removed from cache after successful verify).  
   **Fix:** Issue **two** codes when comparing “broker style” vs “with Bearer” in smoke.

4. **Stale broker Web deployment id in repo**  
   **Symptom:** Wrong `/exec` in Script Properties / docs.  
   **Fix:** Align `tokenBrokerDeploymentId` in local `tt-deploy-ids.json` with the **active** deployment; update broker **Script Properties** (`AUTHENTICATOR_BASE_URL`, etc.).

5. **`clasp deploy` on read-only / HEAD deployment**  
   **Symptom:** `Read-only deployments may not be modified`.  
   **Fix:** Create or select a **managed** deployment in Apps Script and redeploy that id; sample-caller is optional — **production is authenticator + broker**.

6. **Assuming `clasp push` updates live `/exec`**  
   **Cause:** Push updates project source; **deployment version** pins what `/exec` runs.  
   **Fix:** `clasp version` then `clasp deploy -i <deploymentId>`.

---

## Lessons learned (concise)

| Topic | Lesson |
|--------|--------|
| **URLs** | Three different “ids”: script project id, **Web app** deployment id (`/macros/s/.../exec`), **API Executable** id (`...googleapis.com/...:run`). Same product, different rows in Manage deployments. |
| **Transports** | **`webapp`** → `/exec` + JSON `{ action }`. **`script_api`** → Execution API envelope `{ function, parameters, devMode }`. Do not mix. |
| **Verify** | Prefer **body `internalSecret`** + header for broker→authenticator; Bearer on `script.google.com` helps with Google’s edge behavior. |
| **Tests** | Record UrlFetch **payload** and **URL**; use shared **fixtures** so tests read like operations. |
| **Logging** | `Logger.log` + Executions panel for `runSample` step traces. |
| **Deploy** | Redeploy **authenticator web** when `doPost` changes; **API executable** when `issueCode` changes; **broker** when `BrokerApp` changes. |

---

## Related files

| File | Role |
|------|------|
| [`AGENTS.md`](./AGENTS.md) | Rules for agents and operators |
| [`SPEC.md`](./SPEC.md) | Product + technical spec |
| [`OPERATIONS.md`](./OPERATIONS.md) | Procedures, properties table, troubleshooting |
| [`README.md`](./README.md) | Short intro + index |
| [`scripts/tt-deploy-ids.example.json`](./scripts/tt-deploy-ids.example.json) → local `tt-deploy-ids.json` | Deployment ids (keep in sync with Google; local file gitignored) |

---

## Atlas / CC note

This folder lives under **`Projects/CC`** in the Atlas repo. Code may also be mirrored to **`cc-token-triangle`** via `git subtree` (see [`OPERATIONS.md`](./OPERATIONS.md)).
