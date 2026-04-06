const path = require('path');
const { installSampleCallerGasFakes } = require('./vm-fakes/installSampleCaller');
const { runFilesInSandbox, sampleCallerChain } = require('./loadGasSandbox');
const { createSequenceUrlFetchApp } = require('./vm-fakes/fakeUrlFetchApp');
const { createStaticJsonResponse } = require('./vm-fakes/fakeUrlFetchApp');

const CALLER_ROOT = path.join(__dirname, '../sample-caller/src');

/** Wraps a plain result in the Apps Script API response envelope. */
function execApiResponse(result) {
  return createStaticJsonResponse(
    { done: true, response: { '@type': 'type.googleapis.com/google.apps.script.v1.ExecutionResponse', result: result } },
    200
  );
}

describe('Sample caller (GAS fakes + vm sandbox)', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = {};
    const sequence = createSequenceUrlFetchApp([
      function () {
        return createStaticJsonResponse(
          { code: 'challenge-1', expiresInSeconds: 300 },
          200
        );
      },
      function () {
        return createStaticJsonResponse(
          { ok: true, tokens: { DEMO: 'tok' }, missing: [] },
          200
        );
      },
    ]);
    installSampleCallerGasFakes(
      sandbox,
      {
        AUTHENTICATOR_URL: 'https://auth.test/exec',
        TOKEN_BROKER_URL: 'https://broker.test/exec',
        AUTHENTICATOR_SCRIPT_ID: 'fake-auth-script-id',
        TOKEN_BROKER_SCRIPT_ID: 'fake-broker-script-id',
      },
      function (url, options) {
        return sequence.fetch(url, options);
      }
    );
    runFilesInSandbox(sandbox, sampleCallerChain(CALLER_ROOT));
  });

  test('exposes global runSample for IDE Run menu', () => {
    expect(typeof sandbox.runSample).toBe('function');
  });

  test('exposes global getPermission for IDE Run menu', () => {
    expect(typeof sandbox.getPermission).toBe('function');
    const row = sandbox.getPermission();
    expect(row.ok).toBe(true);
    expect(row.action).toBe('getPermission');
    expect(row.service).toBe('cc-token-triangle-sample-caller');
    expect(row.scriptId).toBe('vm-test-script-id');
  });

  test('runSample chains issue and getToken via TOKEN_CLIENT', () => {
    const summary = sandbox.runSample();
    expect(summary.broker.ok).toBe(true);
    expect(summary.broker.tokens.DEMO).toBe('tok');
  });

  test('fetchNamedTokensExec calls Apps Script API with OAuth token', () => {
    const execSequence = createSequenceUrlFetchApp([
      function () {
        return execApiResponse({ code: 'exec-code-1', expiresInSeconds: 60 });
      },
      function () {
        return execApiResponse({ ok: true, tokens: { DEMO: 'exec-tok' }, missing: [] });
      },
    ]);
    const execSandbox = {};
    installSampleCallerGasFakes(
      execSandbox,
      {
        AUTHENTICATOR_SCRIPT_ID: 'fake-auth-script-id',
        TOKEN_BROKER_SCRIPT_ID: 'fake-broker-script-id',
      },
      function (url, options) {
        return execSequence.fetch(url, options);
      }
    );
    runFilesInSandbox(execSandbox, sampleCallerChain(CALLER_ROOT));
    const result = execSandbox.TOKEN_CLIENT.fetchNamedTokensExec(['DEMO']);
    expect(result.broker.tokens.DEMO).toBe('exec-tok');
    expect(result.issued.expiresInSeconds).toBe(60);
  });
});
