const path = require('path');
const { installSampleCallerGasFakes } = require('./vm-fakes/installSampleCaller');
const { runFilesInSandbox, sampleCallerChain } = require('./loadGasSandbox');
const { createSequenceUrlFetchApp } = require('./vm-fakes/fakeUrlFetchApp');
const { createStaticJsonResponse } = require('./vm-fakes/fakeUrlFetchApp');

const CALLER_ROOT = path.join(__dirname, '../sample-caller/src');

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
});
