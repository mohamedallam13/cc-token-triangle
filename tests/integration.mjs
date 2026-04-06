/**
 * Optional live check against deployed web apps.
 * Usage:
 *   AUTHENTICATOR_URL=... TOKEN_BROKER_URL=... node tests/integration.mjs
 */

const authUrl = process.env.AUTHENTICATOR_URL;
const brokerUrl = process.env.TOKEN_BROKER_URL;
const names = (process.env.TEST_TOKEN_NAMES || 'DEMO').split(',').map((s) => s.trim());

async function main() {
  if (!authUrl || !brokerUrl) {
    console.log(
      'Skip integration: set AUTHENTICATOR_URL and TOKEN_BROKER_URL (optional TEST_TOKEN_NAMES)'
    );
    process.exit(0);
  }

  const issueRes = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'issue' }),
  });
  const issue = await issueRes.json();
  if (!issue.code) {
    console.error('Issue failed', issue);
    process.exit(1);
  }

  const tokRes = await fetch(brokerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getToken',
      code: issue.code,
      names,
    }),
  });
  const tok = await tokRes.json();
  console.log(JSON.stringify({ issue, tok }, null, 2));
  if (!tok.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
