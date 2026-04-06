/**
 * Canonical shapes for Script Properties — mirrors production keys (test values only).
 * Tests should use these instead of ad-hoc strings.
 */
const OPS = {
  /** Shared plumbing secret (authenticator AUTH_INTERNAL_SECRET === broker AUTH_INTERNAL_SECRET) */
  AUTH_INTERNAL_SECRET: 'cct-int-plumbing-test-vm-8f4e2a9c7b1d4e6f9a3c2d8e5f1b4a7c',
  CALLER_SECRET: 'cct-issue-plumbing-test-vm-6d3b9f2e8a4c1e7b',
  TOKEN_DEMO: 'sk-cct-demo-test-vm-7Kp2mN9qR4sT8vWx1Yz3AbC6DeFgHiJkLmNoPqRsTuVwXyZ0123456789',
  /** Web /exec only — never script.googleapis.com */
  AUTHENTICATOR_WEB_EXEC:
    'https://script.google.com/macros/s/AKfycbzTESTAUTHWEBONLY/exec',
  BROKER_WEB_EXEC:
    'https://script.google.com/macros/s/AKfycbzTESTBROKERWEBONLY/exec',
  AUTH_API_RUN:
    'https://script.googleapis.com/v1/scripts/AKfycbzTESTAUTHAPIONLY:run',
  BROKER_API_RUN:
    'https://script.googleapis.com/v1/scripts/AKfycbzTESTBROKERAPIONLY:run',
};

/** Broker project properties (what BrokerApp reads) */
function brokerScriptProperties() {
  return {
    AUTHENTICATOR_BASE_URL: OPS.AUTHENTICATOR_WEB_EXEC,
    AUTH_INTERNAL_SECRET: OPS.AUTH_INTERNAL_SECRET,
    TOKEN_DEMO: OPS.TOKEN_DEMO,
  };
}

/** Sample-caller client properties — webapp + webapp (operations default) */
function sampleCallerWebWebProperties() {
  return {
    AUTHENTICATOR_TRANSPORT: 'webapp',
    TOKEN_BROKER_TRANSPORT: 'webapp',
    AUTHENTICATOR_URL: OPS.AUTHENTICATOR_WEB_EXEC,
    TOKEN_BROKER_URL: OPS.BROKER_WEB_EXEC,
    CALLER_SECRET: OPS.CALLER_SECRET,
    DEMO_TOKEN_NAMES: 'DEMO',
  };
}

/** Sample-caller — Script API for both (Execution API :run URLs) */
function sampleCallerApiApiProperties() {
  return {
    AUTHENTICATOR_TRANSPORT: 'script_api',
    TOKEN_BROKER_TRANSPORT: 'script_api',
    AUTHENTICATOR_URL: OPS.AUTH_API_RUN,
    TOKEN_BROKER_URL: OPS.BROKER_API_RUN,
    CALLER_SECRET: OPS.CALLER_SECRET,
    DEMO_TOKEN_NAMES: 'DEMO',
  };
}

module.exports = {
  OPS,
  brokerScriptProperties,
  sampleCallerWebWebProperties,
  sampleCallerApiApiProperties,
};
