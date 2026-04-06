/**
 * ONE-TIME — Apps Script only (no Node).
 * Run → runTtSetupSampleCaller, then delete this file + remove from .clasp.json filePushOrder.
 *
 * _TT_CALLER_SECRET must match Authenticator CALLER_SECRET (custom header secret — not OAuth).
 *
 * Pinned /exec URLs — update if you redeploy (see scripts/tt-deploy-ids.json).
 */
const _AUTHENTICATOR_URL =
  'https://script.google.com/macros/s/AKfycbz8cvUkmBXI8DHD9WYoXF7IqwpPKmu6R7VY5q4eT0Pkm4TCIIAN32V5hlo7sbj367Ha/exec';
const _TOKEN_BROKER_URL =
  'https://script.google.com/macros/s/AKfycbwCiGIAr8FyCxtEVGVvt65S3zAp3_F0DKJUt-eMwUZKTOYkCq6ZQNPoYiOV1uHHR4jz3g/exec';

const _TT_CALLER_SECRET =
  'cct-issue-plumbing-6d3b9f2e8a4c1e7b5f9d3c6a2e8b1d4f7a9c0e3b6d2f5a8';

function runTtSetupSampleCaller() {
  if (!_TT_CALLER_SECRET) {
    throw new Error('SetupTemp.js: caller secret must be non-empty.');
  }
  const props = PropertiesService.getScriptProperties();
  // Web app path (ANYONE_ANONYMOUS)
  props.setProperty('AUTHENTICATOR_URL', String(_AUTHENTICATOR_URL).replace(/\s+/g, ''));
  props.setProperty('TOKEN_BROKER_URL', String(_TOKEN_BROKER_URL).replace(/\s+/g, ''));
  props.setProperty('CALLER_SECRET', String(_TT_CALLER_SECRET));
  props.setProperty('DEMO_TOKEN_NAMES', 'DEMO');
  // API Executable path (DOMAIN-restricted) — same secrets, different entry
  props.setProperty('AUTHENTICATOR_SCRIPT_ID', '1EKXuzhL3LZfveE2ROF9JlALWJt0y5U8ueMFudoknnkGN9yGunU8s_p_q');
  props.setProperty('TOKEN_BROKER_SCRIPT_ID', '1ipvbqj-PXfROuNN5Zv8MhQFctINFxdGz9FVDAnZxafl8iKKmoIy2XOul');
  return JSON.stringify({
    ok: true,
    keys: ['AUTHENTICATOR_URL', 'TOKEN_BROKER_URL', 'CALLER_SECRET', 'DEMO_TOKEN_NAMES',
           'AUTHENTICATOR_SCRIPT_ID', 'TOKEN_BROKER_SCRIPT_ID'],
  });
}
