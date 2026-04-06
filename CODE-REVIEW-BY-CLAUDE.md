# Code Review by Claude — Token Triangle

**Date:** 2026-04-06
**Reviewer:** Claude Sonnet 4.6
**Scope:** Full system review + hardening pass

---

## What the system does

Three-leg GAS auth pattern for sharing secrets across multiple Apps Script projects without hardcoding them.

**Flow:**
```
Consumer (caller)
  → POST /issue  → Authenticator  (returns short-lived code)
  → POST /getToken → Broker       (verifies code with Authenticator, returns TOKEN_* values)
```

| Project | Role | Web app? |
|---|---|---|
| `authenticator/` | Issues short-lived codes; verifies codes for the broker | Yes |
| `token-broker/` | Verifies code with Authenticator; returns `TOKEN_*` from Script Properties | Yes |
| `sample-caller/` | Demo + reusable `TokenClient.js` | No |

---

## Issues Found

### 1. TTL too long ✅ Fixed
**File:** `authenticator/src/ENV.js`
`CODE_TTL_SECONDS` was `300` (5 minutes). Challenge codes should be short-lived. 5 minutes is plenty of time for a replay attack if a code is intercepted in transit.
**Fix:** Changed to `60` seconds.

---

### 2. `/issue` endpoint was open — no caller authentication ✅ Fixed
**Files:** `authenticator/src/ENV.js`, `authenticator/src/AuthApp.js`, `authenticator/src/Utils.js`, `sample-caller/src/TokenClient.js`

Any script that discovered the Authenticator URL could call `POST { action: "issue" }` with no credentials and receive a valid challenge code. Protection was fully deferred to the Broker's `AUTH_INTERNAL_SECRET` gate during verify — one layer, no depth.

**Fix:** Added a **caller secret** (soft gate):
- New Script Property: `CALLER_SECRET` on the Authenticator
- `AuthApp` checks `X-Caller-Secret` header on every `/issue` call when the property is configured
- `TokenClient` reads `CALLER_SECRET` from the consumer's Script Properties and adds it as a header
- **Soft gate:** if `CALLER_SECRET` is not set, the check is skipped — backward compatible. Activate by setting the property.

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

**Note:** The `get` + `put` is not atomic (GAS limitation). This is a soft protection against abuse, not a hard lock. Acceptable for internal tooling.

**New `AUTH_ENV` exports:** `ISSUE_RATE_KEY`, `ISSUE_RATE_MAX`
**New `AuthApp` private functions:** `checkIssueRateLimit(cache)`

---

### 4. `missing` tokens returned silently with `ok: true` ✅ Fixed
**File:** `token-broker/src/BrokerApp.js`

When the Broker couldn't find a requested token name in Script Properties, it added it to a `missing[]` array but still returned `ok: true`. Callers had to check `result.broker.missing` manually — easy to miss, caused silent downstream failures.

**Fix:** `runExchange` now returns `ok: false` when any requested name is missing:
```js
{ ok: false, error: "Unknown token names: X, Y", missing: ["X", "Y"] }
```
`handlePost` forwards the `missing` array in the error response so callers can diagnose which names are unconfigured.

---

### 5. `SetupTemp.js` footgun ✅ Fixed
**File:** `.gitignore`

`SetupTemp.js` files are one-off bootstrappers that set Script Properties on fresh deployments. They were present in the repo but not gitignored. If someone pushed without deleting them, those `_ttSetup*` functions would be live in the deployed script.

**Fix:** Added `**/SetupTemp.js` to `.gitignore`.

---

## Issues Not Fixed (GAS limitations or by design)

### `AUTH_INTERNAL_SECRET` on the wire
The Broker sends `X-Internal-Secret: <secret>` to the Authenticator on every verify call. No mutual TLS, no request signing with nonce/timestamp available in GAS. The security model is "the wire is trusted." Acceptable for internal tooling — document it and keep the Authenticator URL private.

### Single point of failure
Both the Authenticator and Broker must be deployed and live. If either goes down (GAS quota exceeded, auth expired on `theoracle@cairoconfessions.com`, accidental HEAD-only push), all consumers break simultaneously. No retry or circuit breaker in `TokenClient.js`. Document this dependency explicitly.

### Naming
The system is called "Token Triangle" but the flow is linear (chain), not triangular. The Caller never talks to the Authenticator for the verify step — the Broker does that. Low-priority naming issue.

---

## Files Changed

| File | Change |
|---|---|
| `authenticator/src/ENV.js` | TTL 300→60, add `PROP_CALLER_SECRET`, `getCallerSecret()`, `ISSUE_RATE_KEY`, `ISSUE_RATE_MAX` |
| `authenticator/src/Utils.js` | Add `extractCallerSecret(headers)` |
| `authenticator/src/AuthApp.js` | Add `checkIssueRateLimit(cache)`, `checkCallerSecret(headers)`; refactor `routeIssue(event)` to accept event; pass cache down to `issueNewCode(cache)` |
| `sample-caller/src/TokenClient.js` | Add `PROP_CALLER_SECRET`; read and forward `X-Caller-Secret` header on `/issue`; `postJson` accepts optional `extraHeaders` |
| `token-broker/src/BrokerApp.js` | `runExchange`: return `ok:false` + `missing[]` when any token name is not found; `handlePost`: forward `missing` in error response |
| `.gitignore` | Add `**/SetupTemp.js` |
| `tests/authenticator.gas.test.js` | Add `CALLER_SECRET` to props; add `X-Caller-Secret` header to all issue events; add `issue rejects unauthorized caller` test |
| `tests/token-broker.gas.test.js` | Update missing-keys test to assert `ok: false` and check `missing` array in response |

**Test result:** 21/21 passing after all changes.

---

## Deploy Checklist After This Review

- [ ] `clasp-cc push` → `clasp-cc version "harden: TTL + caller secret + rate limit"` → `clasp-cc deploy -i <deploymentId> -V <version>` on **Authenticator**
- [ ] `clasp-cc push` → version + deploy on **Token Broker**
- [ ] Set `CALLER_SECRET=<shared-value>` in Authenticator's Script Properties
- [ ] Set `CALLER_SECRET=<shared-value>` in every consumer script's Script Properties
- [ ] Delete `SetupTemp.js` from all three project `src/` folders if still present, remove from `filePushOrder` in `.clasp.json`
- [ ] Verify `runSample()` still works end-to-end after redeploy
