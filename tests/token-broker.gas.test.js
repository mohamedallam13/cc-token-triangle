const path = require('path');
const { installTokenBrokerGasFakes } = require('./vm-fakes/installTokenBroker');
const { runFilesInSandbox, tokenBrokerChain } = require('./loadGasSandbox');
const { readTextOutput } = require('./vm-fakes/readTextOutput');
const { createStaticJsonResponse } = require('./vm-fakes/fakeUrlFetchApp');

const BROKER_ROOT = path.join(__dirname, '../token-broker/src');

describe('Token broker (GAS fakes + vm sandbox)', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = {};
    installTokenBrokerGasFakes(
      sandbox,
      {
        AUTHENTICATOR_BASE_URL: 'https://example.test/exec',
        AUTH_INTERNAL_SECRET: 'broker-secret',
        TOKEN_DEMO: 'secret-value-demo',
      },
      function () {
        return createStaticJsonResponse({ valid: true }, 200);
      }
    );
    runFilesInSandbox(sandbox, tokenBrokerChain(BROKER_ROOT));
  });

  test('exposes global doGet and doPost for web app deployment', () => {
    expect(typeof sandbox.doGet).toBe('function');
    expect(typeof sandbox.doPost).toBe('function');
  });

  test('exposes global getNamedTokens for API executable deployment', () => {
    expect(typeof sandbox.getNamedTokens).toBe('function');
  });

  test('getNamedTokens returns tokens via exec path', () => {
    const result = sandbox.getNamedTokens('any-code', ['DEMO']);
    expect(result.ok).toBe(true);
    expect(result.tokens.DEMO).toBe('secret-value-demo');
  });

  test('getNamedTokens throws on missing token via exec path', () => {
    expect(() => sandbox.getNamedTokens('any-code', ['MISSING'])).toThrow();
  });

  test('getPermission returns broker metadata', () => {
    const json = readTextOutput(
      sandbox.doPost({
        postData: {
          contents: JSON.stringify({ action: 'getPermission' }),
        },
        headers: {},
      })
    );
    expect(json.ok).toBe(true);
    expect(json.service).toBe('cc-token-triangle-broker');
    expect(json.scriptId).toBe('vm-test-script-id');
    expect(json.oauthScopes.length).toBeGreaterThan(0);
  });

  test('getToken returns named tokens after verify', () => {
    const event = {
      postData: {
        contents: JSON.stringify({
          action: 'getToken',
          code: 'any-code',
          names: ['DEMO'],
        }),
      },
      headers: {},
    };
    const out = sandbox.doPost(event);
    const json = readTextOutput(out);
    expect(json.ok).toBe(true);
    expect(json.tokens.DEMO).toBe('secret-value-demo');
  });

  test('getToken returns ok:false and lists missing keys', () => {
    const event = {
      postData: {
        contents: JSON.stringify({
          action: 'getToken',
          code: 'any-code',
          names: ['DEMO', 'MISSING'],
        }),
      },
      headers: {},
    };
    const json = readTextOutput(sandbox.doPost(event));
    expect(json.ok).toBe(false);
    expect(json.missing).toContain('MISSING');
    expect(json.code).toBeUndefined(); // no partial token leak on failure
  });
});
