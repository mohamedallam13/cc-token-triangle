# Code Review by Claude — Token Triangle

**Date:** 2026-04-06
**Reviewer:** Claude Sonnet 4.6
**Scope:** Full system review + hardening pass
**Status:** Changes listed below are committed to the repo (`fix(token-triangle)` commit). This document is a change log, not a spec — if the tree diverges from what's described here, the tree is authoritative.

---

## What the system does

Three-leg GAS auth pattern for sharing secrets across multiple Apps Script projects without hardcoding them.

**Flow:**
```
Consumer (caller)
  → POST /issue    → Authenticator  (returns short-lived code)
  → POST /getToken → Broker         (verifies code with Authenticator, returns TOKEN_* values)
```

> **Naming note:** The system is called "Token Triangle" but the flow is a linear chain — the Caller talks to the Authenticator for issue and to the Broker for exchange. The Broker calls the Authenticator internally for verify. There is no triangular back-channel from Broker to Caller. Low-priority to rename; just don't let the name mislead you into thinking there's a different topology.

| Project | Role | Web app? |
|---|---|---|
| `authenticator/` | Issues short-lived codes; verifies codes for the broker | Yes |
| `token-broker/` | Verifies code with Authenticator; returns `TOKEN_*` from Script Properties | Yes |
| `sample-caller/` | Demo + reusable `TokenClient.js` | No |

---

## Issues Found & Fixed

### 1. TTL too long ✅ Fixed
**File:** `authenticator/src/ENV.js`

`CODE_TTL_SECONDS` was `300` (5 minutes). Challenge codes should be short-lived — 5 minutes is a wide replay window if a code is intercepted in transit.

**Fix:** Changed to `60` seconds.

**Caveat:** If the Broker or network is slow, or if there is any human-in-the-loop step between issue and exchange, 60s can produce spurious failures. If you see `Invalid or expired code` errors in normal operation, revisit this value — but don't raise it above 120s without a specific reason.

---

### 2. `/issue` endpoint was open — no caller authentication ✅ Fixed
**Files:** `authenticator/src/ENV.js`, `authenticator/src/AuthApp.js`, `authenticator/src/Utils.js`, `sample-caller/src/TokenClient.js`

Any script that discovered the Authenticator URL could call `POST { action: "issue" }` with no credentials and receive a valid challenge code. Protection was fully deferred to the Broker's `AUTH_INTERNAL_SECRET` gate during verify — one layer, no depth.

**Fix:** Added a **caller secret** (soft gate):
- New Script Property: `CALLER_SECRET` on the Authenticator
- `AuthApp` checks `X-Caller-Secret` header on every `/issue` call when the property is configured
- `TokenClient` reads `CALLER_SECRET` from the consumer's Script Properties and forwards it as a header
- **Soft gate:** if `CALLER_SECRET` is not set on the Authenticator, the check is skipped — backward compatible for migration

**⚠️ Operational warning:** An unset `CALLER_SECRET` means no check runs. The system will appear to work but the `/issue` endpoint remains open. **Treat "unset" as insecure, not as "secure by default."** The deploy checklist below reflects this — setting the property is not optional, it's step 3.

**New `AUTH_ENV` exports:** `PROP_CALLER_SECRET`, `getCallerSecret()`
**New `AUTH_UTILS` export:** `extractCallerSecret(headers)`
**New `AuthApp` private functions:** `checkCallerSecret(headers)`

**Migration:** Set `CALLER_SECRET=<shared value>` in:
1. Authenticator's Script Properties
2. Every consumer script's Script Properties

---

### 3. No rate limiting on `/issue` ✅ Fixed
**Files:** `authenticator/src/ENV.js`, `authenticator/src/AuthApp.js`

Anyone who knew the Authenticator URL could spam `/issue` and exhaust CacheService quota, degrading availability for all consumers.

**Fix:** Added `checkIssueRateLimit(cache)` — CacheService 1-minute bucket counter.
- Key pattern: `cct_issue_rate:<minute_bucket>`
- Max: `30` calls per minute globally (`ISSUE_RATE_MAX`)
- Returns `{ ok: false, error: "Too many requests — try again shortly" }` when exceeded
- Cache key TTL is 120s to cleanly cover bucket boundaries

**Caveats:**
- The `get` + `put` is **not atomic** (GAS has no compare-and-swap). This is a soft abuse deterrent, not a hard lock. Under a genuine coordinated flood, a few extra calls can sneak through the race window.
- The limit is **global** — one bucket shared across all consumers. If CC ever runs many automations simultaneously (e.g. 5 scripts each calling issue multiple times per minute), legitimate traffic could start hitting the cap. If that happens, raise `ISSUE_RATE_MAX` or switch to per-caller tracking keyed on `CALLER_SECRET` value.

**New `AUTH_ENV` exports:** `ISSUE_RATE_KEY`, `ISSUE_RATE_MAX`
**New `AuthApp` private functions:** `checkIssueRateLimit(cache)`

---

### 4. `missing` tokens returned silently with `ok: true` ✅ Fixed
**File:** `token-broker/src/BrokerApp.js`

When the Broker couldn't find a requested token name in Script Properties, it added it to a `missing[]` array but still returned `ok: true`. Callers had to check `result.broker.missing` manually — easy to miss, caused silent downstream failures.

**Fix:** `runExchange` now returns `ok: false` when **any** requested name is missing:
```js
{ ok: false, error: "Unknown token names: X, Y", missing: ["X", "Y"] }
```
`handlePost` forwards the `missing` array in the error response so callers can diagnose which names are unconfigured.

**⚠️ Breaking change for "best-effort" consumers:** The old behavior allowed partial success — some tokens returned, some in `missing[]`, overall `ok: true`. Any existing caller that intentionally requested multiple names and handled partial results will now get `ok: false` and no tokens at all. If you have a consumer that wanted best-effort semantics, it needs to either: (a) request only names it knows exist, or (b) be updated to handle `ok: false` + inspect `missing[]` before giving up.

---

### 5. `SetupTemp.js` footgun ✅ Fixed
**File:** `.gitignore`

`SetupTemp.js` files are one-off bootstrappers that set Script Properties on fresh deployments. They were present in the repo but not gitignored. If someone pushed without deleting them, those `_ttSetup*` functions would be live in the deployed script.

**Fix:** Added `**/SetupTemp.js` to `.gitignore`.

**Tradeoff to be aware of:** Gitignoring these files improves push safety but removes them from version control — a new developer cloning the repo won't see the bootstrap helpers and will have to reconstruct them from `AGENTS.md`. The alternatives that were considered:
- **Keep in repo, exclude from `filePushOrder`** — bootstrap is visible, but requires discipline to keep it out of `filePushOrder` and relies on knowing that GAS only pushes files listed there.
- **Pre-push check** — a git hook that rejects pushes if `SetupTemp.js` is in any `filePushOrder` — more robust but more setup.

The gitignore approach was chosen because the bootstrap procedure is fully documented in `AGENTS.md` and the risk of accidentally deploying a setup helper outweighs the reproducibility cost. If you need to re-bootstrap, follow `AGENTS.md` — don't rely on the file being in the repo.

---

## Issues Not Fixed (GAS limitations or by design)

### `AUTH_INTERNAL_SECRET` on the wire
The Broker sends `X-Internal-Secret: <secret>` to the Authenticator on every verify call. No mutual TLS, no request signing with nonce/timestamp available in GAS. The security model is: **the wire is trusted.** Acceptable for internal tooling — keep both service URLs private and do not log them.

### Single point of failure
Both the Authenticator and Broker must be deployed and live. If either goes down (GAS quota exceeded, auth expired on `theoracle@cairoconfessions.com`, accidental HEAD-only push), all consumers break simultaneously. `TokenClient.js` has no retry or circuit breaker. This is a known operational risk — monitor `theoracle` account health and keep deployment IDs in `scripts/tt-deploy-ids.json` up to date.

---

## Files Changed

| File | Change |
|---|---|
| `authenticator/src/ENV.js` | TTL 300→60; add `PROP_CALLER_SECRET`, `getCallerSecret()`, `ISSUE_RATE_KEY`, `ISSUE_RATE_MAX` |
| `authenticator/src/Utils.js` | Add `extractCallerSecret(headers)` |
| `authenticator/src/AuthApp.js` | Add `checkIssueRateLimit(cache)`, `checkCallerSecret(headers)`; refactor `routeIssue(event)` to accept event; pass cache down to `issueNewCode(cache)` |
| `sample-caller/src/TokenClient.js` | Add `PROP_CALLER_SECRET`; read and forward `X-Caller-Secret` header on `/issue`; `postJson` accepts optional `extraHeaders` |
| `token-broker/src/BrokerApp.js` | `runExchange`: return `ok:false` + `missing[]` when any token name is not found; `handlePost`: forward `missing` in error response |
| `.gitignore` | Add `**/SetupTemp.js` |
| `tests/authenticator.gas.test.js` | Add `CALLER_SECRET` to props; add `X-Caller-Secret` header to all issue events; add `issue rejects unauthorized caller` test |
| `tests/token-broker.gas.test.js` | Update missing-keys test to assert `ok: false` and `missing` in response |

**Test result:** 21/21 passing after all changes.

---

## Deploy Checklist After This Review

> **Do not assume the system is hardened until steps 3 and 4 are complete.** The code supports the caller secret check but it only activates once the Script Property is set.

- [ ] `clasp-cc push` → `clasp-cc version "harden: TTL + caller secret + rate limit"` → `clasp-cc deploy -i <deploymentId> -V <version>` on **Authenticator**
- [ ] `clasp-cc push` → version + deploy on **Token Broker**
- [ ] **Set `CALLER_SECRET=<shared-value>`** in Authenticator's Script Properties ← system is NOT hardened until this is done
- [ ] **Set `CALLER_SECRET=<shared-value>`** in every consumer script's Script Properties ← same value as above
- [ ] Delete `SetupTemp.js` from all three project `src/` folders if still present; remove from `filePushOrder` in each `.clasp.json`
- [ ] Verify `runSample()` still works end-to-end after redeploy
- [ ] If any existing consumer used best-effort token fetching (requested names it knew might be missing), update it to handle `ok: false` + inspect `missing[]`
