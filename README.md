# Token Triangle (CC)

Internal **challenge → exchange** for named secrets without pasting tokens into every script.

- **Authenticator** & **Token broker**: web apps (`doGet` / `doPost` are **global** in `main.js` — required by GAS).
- **Consumer projects**: copy **[`sample-caller/src/TokenClient.js`](file:///Users/mohamed.allam/Documents/Atlas/Projects/CC/Systems/Token%20Triangle/sample-caller/src/TokenClient.js)** and wire Script Properties.

**Deploy:** `theoracle@cairoconfessions.com` via **`clasp-cc`**.

| Doc | Use for |
|-----|---------|
| **[`OPERATIONS.md`](./OPERATIONS.md)** | Full **context**, **step-by-step procedures**, **lessons learned**, troubleshooting |
| **[`AGENTS.md`](./AGENTS.md)** | Agent rules: `main.js`, UMD layout, deploy model, Script properties |
| **[`SPEC.md`](./SPEC.md)** | Short product + test spec |

**Tests:** `npm install` → `npm test` (Jest, `@mcpher/gas-fakes` on `globalThis`, plus `tests/vm-fakes/` for isolated `vm` sandboxes).

**One-off property wiring:** `TT_AUTH_INTERNAL_SECRET=… npm run setup:urls` — see `AGENTS.md` (writes `scripts/generated/…`, temporary `SetupTemp.js`).

**Atlas GAS skills:** UMD modules use `})(this, …)`; pure logic stays in `Utils.js`; `AuthApp.js` / `BrokerApp.js` hold I/O for each server.
