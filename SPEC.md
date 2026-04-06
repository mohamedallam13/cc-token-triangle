# Token Triangle — SPEC

**Operations & procedures:** [`OPERATIONS.md`](./OPERATIONS.md) · **Context & timeline:** [`CONTEXT.md`](./CONTEXT.md) · **Agent rules:** [`AGENTS.md`](./AGENTS.md)

---

## Purpose

Allow **consumer** Google Apps Script projects to retrieve **named external secrets** (e.g. `TOKEN_DEMO`) from a **token broker** without storing those secrets in every project. Access is gated by:

1. **Issue** — consumer obtains a **short-lived challenge code** from the **authenticator** (protected by `CALLER_SECRET` on issue).
2. **Exchange** — consumer sends that code to the **broker**; the broker **verifies** the code with the authenticator (using **`AUTH_INTERNAL_SECRET`**) and returns **token values** from broker Script Properties (`TOKEN_<NAME>`).

---

## Components

| Project | Responsibility | Typical deployment |
|---------|------------------|--------------------|
| **authenticator** | Issue codes (cache TTL); verify codes (one-time consume) | **Web app** `/exec` + optional **API Executable** for `issueCode` |
| **token-broker** | `UrlFetch` verify → authenticator; return `TOKEN_*` keys | **Web app** `/exec` + optional **API Executable** for `getNamedTokens` |
| **sample-caller** | Reference **`TokenClient.js`** + `runSample()` | Optional; not in production request path |

In this repository the three clasp projects live under **`apps/`** (`apps/authenticator/`, `apps/token-broker/`, `apps/sample-caller/`).

---

## HTTP contracts (Web app `/exec`)

### Authenticator `POST` JSON

| `action` | Body | Headers | Response |
|----------|------|---------|----------|
| `issue` | `{ "action": "issue" }` — add **`callerSecret`** in body when Web app omits headers | `X-Caller-Secret` (if configured) — body fallback same as verify | `{ "code", "expiresInSeconds" }` |
| `verify` | `{ "action": "verify", "code": "<uuid>", "internalSecret": "<secret>" }` | `X-Internal-Secret` optional (same value) | `{ "valid": true }` or `{ "valid": false, "error": "…" }` |

**Note:** For **verify**, `internalSecret` in the body is **required in practice** when the runtime does not pass custom headers through to `event.headers`. For **issue**, send **`callerSecret` in the JSON body** as well as (or instead of) `X-Caller-Secret` for the same reason.

### Token broker `POST` JSON

| `action` | Body | Response |
|----------|------|----------|
| `getToken` | `{ "action": "getToken", "code": "<challenge>", "names": ["DEMO", …] }` | `{ "ok": true, "tokens": { … }, "missing": [] }` or `{ "ok": false, "error": "…", "missing": […] }` |

---

## Consumer module output (`TOKEN_CLIENT.fetchNamedTokens`)

Returned object:

```json
{
  "httpIssue": 200,
  "httpBroker": 200,
  "issued": { "expiresInSeconds": 60 },
  "broker": { "ok": true, "tokens": { "DEMO": "…" }, "missing": [] }
}
```

On failure, `broker` may contain `{ "ok": false, "error": "…" }` or an error-shaped JSON from the broker.

---

## Transports (`TokenClient.js`)

| Property | Values |
|----------|--------|
| `AUTHENTICATOR_TRANSPORT` / `TOKEN_BROKER_TRANSPORT` | `webapp` or `script_api` |
| `AUTHENTICATOR_URL` / `TOKEN_BROKER_URL` | **webapp:** `https://script.google.com/macros/s/…/exec` · **script_api:** full `:run` URL or bare API Executable id |

**webapp** URLs must **not** be `script.googleapis.com` — the client throws before UrlFetch.

---

## Local tests

- **Root:** `npm test` (Jest + `vm` + `@mcpher/gas-fakes`).
- **Fixtures:** `tests/fixtures/opsProperties.js` — canonical property maps aligned with operations.
- **Recording:** `createRecordingUrlFetchApp` — asserts URL, headers, and JSON payload (verify includes `internalSecret`).

---

## IDs file

Local [`scripts/tt-deploy-ids.json`](./scripts/tt-deploy-ids.json) (from [`scripts/tt-deploy-ids.example.json`](./scripts/tt-deploy-ids.example.json)) — script project ids, **Web** deployment ids (`/exec`), **API Executable** ids (`:run`). Update when deployments change intentionally.
