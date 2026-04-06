const path = require('path');
const { installAuthenticatorGasFakes } = require('./vm-fakes/installAuthenticator');
const { runFilesInSandbox, authenticatorChain } = require('./loadGasSandbox');
const { readTextOutput } = require('./vm-fakes/readTextOutput');

const AUTH_ROOT = path.join(__dirname, '../authenticator/src');

describe('Authenticator (GAS fakes + vm sandbox)', () => {
  test('bootstrap loaded @mcpher/gas-fakes (Utilities on globalThis)', () => {
    expect(globalThis.ScriptApp && globalThis.ScriptApp.isFake).toBe(true);
    expect(typeof globalThis.Utilities.getUuid).toBe('function');
  });

  let sandbox;
  beforeEach(() => {
    sandbox = {};
    installAuthenticatorGasFakes(sandbox, {
      AUTH_INTERNAL_SECRET: 'test-internal',
      CALLER_SECRET: 'test-caller',
    });
    runFilesInSandbox(sandbox, authenticatorChain(AUTH_ROOT));
  });

  test('exposes global doGet and doPost for web app deployment', () => {
    expect(typeof sandbox.doGet).toBe('function');
    expect(typeof sandbox.doPost).toBe('function');
  });

  test('exposes global issueCode for API executable deployment', () => {
    expect(typeof sandbox.issueCode).toBe('function');
  });

  test('issueCode returns a code and TTL via exec path', () => {
    const result = sandbox.issueCode();
    expect(result.code).toBeDefined();
    expect(result.expiresInSeconds).toBeGreaterThan(0);
  });

  test('getPermission via POST returns script and scope metadata', () => {
    const out = sandbox.doPost({
      postData: {
        contents: JSON.stringify({ action: 'getPermission' }),
      },
      headers: {},
    });
    const json = readTextOutput(out);
    expect(json.ok).toBe(true);
    expect(json.action).toBe('getPermission');
    expect(json.service).toBe('cc-token-triangle-authenticator');
    expect(json.scriptId).toBe('vm-test-script-id');
    expect(Array.isArray(json.oauthScopes)).toBe(true);
  });

  test('getPermission via GET query works', () => {
    const out = sandbox.doGet({ parameter: { action: 'getPermission' } });
    const json = readTextOutput(out);
    expect(json.action).toBe('getPermission');
    expect(json.authStatus).toBeDefined();
  });

  test('issue returns a code', () => {
    const event = {
      postData: {
        contents: JSON.stringify({ action: 'issue' }),
      },
      headers: { 'X-Caller-Secret': 'test-caller' },
    };
    const out = sandbox.doPost(event);
    const json = readTextOutput(out);
    expect(json.code).toBeDefined();
    expect(json.expiresInSeconds).toBeGreaterThan(0);
  });

  test('issue rejects unauthorized caller', () => {
    const event = {
      postData: {
        contents: JSON.stringify({ action: 'issue' }),
      },
      headers: { 'X-Caller-Secret': 'wrong-secret' },
    };
    const json = readTextOutput(sandbox.doPost(event));
    expect(json.ok).toBe(false);
    expect(json.code).toBeUndefined();
  });

  test('verify consumes a valid code', () => {
    const issueEvent = {
      postData: {
        contents: JSON.stringify({ action: 'issue' }),
      },
      headers: { 'X-Caller-Secret': 'test-caller' },
    };
    const issued = readTextOutput(sandbox.doPost(issueEvent));
    const verifyEvent = {
      postData: {
        contents: JSON.stringify({
          action: 'verify',
          code: issued.code,
        }),
      },
      headers: {
        'X-Internal-Secret': 'test-internal',
      },
    };
    const verifyOut = sandbox.doPost(verifyEvent);
    const verifyJson = readTextOutput(verifyOut);
    expect(verifyJson.valid).toBe(true);
  });

  test('verify rejects reused code', () => {
    const issueEvent = {
      postData: {
        contents: JSON.stringify({ action: 'issue' }),
      },
      headers: { 'X-Caller-Secret': 'test-caller' },
    };
    const issued = readTextOutput(sandbox.doPost(issueEvent));
    const verifyEvent = {
      postData: {
        contents: JSON.stringify({
          action: 'verify',
          code: issued.code,
        }),
      },
      headers: {
        'X-Internal-Secret': 'test-internal',
      },
    };
    sandbox.doPost(verifyEvent);
    const second = readTextOutput(sandbox.doPost(verifyEvent));
    expect(second.valid).toBeFalsy();
  });

  test('verify rejects wrong secret', () => {
    const issueEvent = {
      postData: {
        contents: JSON.stringify({ action: 'issue' }),
      },
      headers: { 'X-Caller-Secret': 'test-caller' },
    };
    const issued = readTextOutput(sandbox.doPost(issueEvent));
    const verifyEvent = {
      postData: {
        contents: JSON.stringify({
          action: 'verify',
          code: issued.code,
        }),
      },
      headers: {
        'X-Internal-Secret': 'wrong',
      },
    };
    const json = readTextOutput(sandbox.doPost(verifyEvent));
    expect(json.valid).toBe(false);
  });
});
