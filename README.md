# Token Triangle (Cairo Confessions)

**What it does:** Lets Google Apps Script automation get **named API secrets** (stored only on the **token broker**) by completing a **short-lived challenge** from the **authenticator** — without copying keys into every project.

**Account:** `theoracle@cairoconfessions.com` · **Push:** `clasp-cc` (see Atlas `AGENTS.md` for clasp profiles).

---

## Documentation

| Doc | Purpose |
|-----|---------|
| **[AGENTS.md](./AGENTS.md)** | Rules for agents & operators: layout, deploy, properties, `TokenClient` output |
| **[SPEC.md](./SPEC.md)** | HTTP contracts, transports, consumer return shape |
| **[OPERATIONS.md](./OPERATIONS.md)** | Procedures, Script Properties table, troubleshooting, git subtree |
| **[CONTEXT.md](./CONTEXT.md)** | Timeline, mistakes we hit, lessons learned |

---

## Projects (three clasp roots)

| Folder | Role |
|--------|------|
| [`authenticator/`](./authenticator/) | Issue & verify challenge codes |
| [`token-broker/`](./token-broker/) | Verify via authenticator; return `TOKEN_*` from Script Properties |
| [`sample-caller/`](./sample-caller/) | Copy-paste **[`TokenClient.js`](./sample-caller/src/TokenClient.js)** into consumers |

**Tests (dev machine):** `npm install` → `npm test` — does not call Google live.

**Deployment IDs:** copy [`scripts/tt-deploy-ids.example.json`](./scripts/tt-deploy-ids.example.json) → `scripts/tt-deploy-ids.json` (gitignored) and fill from Google.

**Mirror repo:** [`mohamedallam13/cc-token-triangle`](https://github.com/mohamedallam13/cc-token-triangle) (subtree from Atlas) — see OPERATIONS.md.
