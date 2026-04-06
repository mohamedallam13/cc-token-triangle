const path = require('path');
const { installAuthenticatorGasFakes } = require('./vm-fakes/installAuthenticator');
const { runFilesInSandbox, authenticatorChain } = require('./loadGasSandbox');
const { readTextOutput } = require('./vm-fakes/readTextOutput');

const AUTH_ROOT = path.join(__dirname, '../apps/authenticator/src');

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

  test('issue accepts callerSecret in body when headers empty (web app behavior)', () => {
    const event = {
      postData: {
        contents: JSON.stringify({
          action: 'issue',
          callerSecret: 'test-caller',
        }),
      },
      headers: {},
    };
    const json = readTextOutput(sandbox.doPost(event));
    expect(json.code).toBeDefined();
    expect(json.expiresInSeconds).toBeGreaterThan(0);
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

  test('verify rejects unknown or never-issued code', () => {
    const verifyEvent = {
      postData: {
        contents: JSON.stringify({
          action: 'verify',
          code: '00000000000000000000000000000000',
        }),
      },
      headers: {
        'X-Internal-Secret': 'test-internal',
      },
    };
    const json = readTextOutput(sandbox.doPost(verifyEvent));
    expect(json.valid).toBe(false);
  });

  test('verify accepts internalSecret in JSON body when headers are empty (web app)', () => {
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
          internalSecret: 'test-internal',
        }),
      },
      headers: {},
    };
    const verifyJson = readTextOutput(sandbox.doPost(verifyEvent));
    expect(verifyJson.valid).toBe(true);
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

  test('POST unknown action returns error', () => {
    const json = readTextOutput(
      sandbox.doPost({
        postData: {
          contents: JSON.stringify({ action: 'not-a-real-action' }),
        },
        headers: {},
      })
    );
    expect(json.error).toMatch(/Unknown or missing action/);
  });

  test('doGet without action returns service heartbeat JSON', () => {
    const json = readTextOutput(sandbox.doGet({ parameter: {} }));
    expect(json.ok).toBe(true);
    expect(json.service).toBe('cc-token-triangle-authenticator');
  });

  test('issue POST respects rate limit after bucket is saturated', () => {
    const bucket = Math.floor(Date.now() / 60000);
    sandbox.CacheService.getScriptCache().put('cct_issue_rate:' + bucket, '30', 120);
    const json = readTextOutput(
      sandbox.doPost({
        postData: {
          contents: JSON.stringify({ action: 'issue' }),
        },
        headers: { 'X-Caller-Secret': 'test-caller' },
      })
    );
    expect(json.ok).toBe(false);
    expect(String(json.error)).toMatch(/Too many requests/);
  });

  test('issueCode throws when rate limit bucket is saturated', () => {
    const local = {};
    installAuthenticatorGasFakes(local, {
      AUTH_INTERNAL_SECRET: 'test-internal',
      CALLER_SECRET: 'test-caller',
    });
    runFilesInSandbox(local, authenticatorChain(AUTH_ROOT));
    const bucket = Math.floor(Date.now() / 60000);
    local.CacheService.getScriptCache().put('cct_issue_rate:' + bucket, '30', 120);
    expect(() => local.issueCode()).toThrow(/Too many requests/);
  });
});
