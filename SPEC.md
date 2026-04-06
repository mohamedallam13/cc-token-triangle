# Token Triangle — SPEC

**Full operations guide:** [`OPERATIONS.md`](./OPERATIONS.md).

## Purpose

Named secrets via **short-lived codes** + **Token broker** Script Properties (`TOKEN_<NAME>`).

## Projects

| Folder | Deploy as web app | Global entry points |
|--------|-------------------|---------------------|
| `authenticator/` | Yes | `doGet`, `doPost` in `main.js` |
| `token-broker/` | Yes | `doGet`, `doPost` in `main.js` |
| `sample-caller/` | Optional | `getPermission()`, `runSample()` in `main.js` + `TokenClient.js` module |

**Live URLs:** web apps use **pinned deployment versions** (`version` + `deploy -i`), not `@HEAD` — see `AGENTS.md`.

## Consumer copy

Single file: **`sample-caller/src/TokenClient.js`** → paste into any GAS project that needs tokens.

## Test strategy

- Pure: `Utils` via `require`.
- GAS-shaped: bootstrap `@mcpher/gas-fakes`, then `vm` sandbox + `tests/vm-fakes/` (Properties/Cache/UrlFetch stubs); **must** assert global `doGet` / `doPost` (and `getPermission` / `runSample` for sample) exist.
