const path = require('path');
const { installTokenBrokerGasFakes } = require('./vm-fakes/installTokenBroker');
const { runFilesInSandbox, tokenBrokerChain } = require('./loadGasSandbox');
const { readTextOutput } = require('./vm-fakes/readTextOutput');
const {
  createStaticJsonResponse,
  createRecordingUrlFetchApp,
} = require('./vm-fakes/fakeUrlFetchApp');
const {
  OPS,
  brokerScriptProperties,
} = require('./fixtures/opsProperties');

const BROKER_ROOT = path.join(__dirname, '../token-broker/src');

function loadBroker(sandbox, props, urlFetchAppOrHandler) {
  installTokenBrokerGasFakes(sandbox, props, urlFetchAppOrHandler);
  runFilesInSandbox(sandbox, tokenBrokerChain(BROKER_ROOT));
}

describe('Token broker — operations shape (matches production)', () => {
  test('verify UrlFetch uses props URL, body.internalSecret, X-Internal-Secret, Bearer on script.google.com', () => {
    const rec = createRecordingUrlFetchApp(function () {
      return createStaticJsonResponse({ valid: true }, 200);
    });
    const local = {};
    loadBroker(local, brokerScriptProperties(), rec.UrlFetchApp);
    local.getNamedTokens('challenge-code', ['DEMO']);
    const calls = rec.getCalls();
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe(OPS.AUTHENTICATOR_WEB_EXEC);
    const body = JSON.parse(calls[0].payload);
    expect(body.action).toBe('verify');
    expect(body.code).toBe('challenge-code');
    expect(body.internalSecret).toBe(OPS.AUTH_INTERNAL_SECRET);
    expect(calls[0].headers['X-Internal-Secret']).toBe(OPS.AUTH_INTERNAL_SECRET);
    expect(String(calls[0].headers.Authorization || '')).toMatch(/^Bearer /);
  });

  test('readBrokerConfig rejects Execution API URL in AUTHENTICATOR_BASE_URL', () => {
    const local = {};
    loadBroker(
      local,
      {
        ...brokerScriptProperties(),
        AUTHENTICATOR_BASE_URL: OPS.AUTH_API_RUN,
      },
      function () {
        return createStaticJsonResponse({ valid: true }, 200);
      }
    );
    const json = readTextOutput(
      local.doPost({
        postData: {
          contents: JSON.stringify({
            action: 'getToken',
            code: 'c',
            names: ['DEMO'],
          }),
        },
        headers: {},
      })
    );
    expect(json.ok).toBe(false);
    expect(String(json.error)).toMatch(/Web app.*\/exec/);
  });

  test('getToken POST returns tokens after verify (client-shaped request)', () => {
    const local = {};
    loadBroker(local, brokerScriptProperties(), function () {
      return createStaticJsonResponse({ valid: true }, 200);
    });
    const json = readTextOutput(
      local.doPost({
        postData: {
          contents: JSON.stringify({
            action: 'getToken',
            code: 'any-code',
            names: ['DEMO'],
          }),
        },
        headers: {},
      })
    );
    expect(json.ok).toBe(true);
    expect(json.tokens.DEMO).toBe(OPS.TOKEN_DEMO);
  });

  test('getNamedTokens API path returns tokens', () => {
    const local = {};
    loadBroker(local, brokerScriptProperties(), function () {
      return createStaticJsonResponse({ valid: true }, 200);
    });
    const result = local.getNamedTokens('x', ['DEMO']);
    expect(result.ok).toBe(true);
    expect(result.tokens.DEMO).toBe(OPS.TOKEN_DEMO);
  });

  test('verify failure surfaces error to POST and exec path', () => {
    const local = {};
    loadBroker(local, brokerScriptProperties(), function () {
      return createStaticJsonResponse(
        { valid: false, error: 'Invalid or expired code' },
        200
      );
    });
    const json = readTextOutput(
      local.doPost({
        postData: {
          contents: JSON.stringify({
            action: 'getToken',
            code: 'bad',
            names: ['DEMO'],
          }),
        },
        headers: {},
      })
    );
    expect(json.ok).toBe(false);
    expect(String(json.error)).toMatch(/Invalid or expired/);
    expect(() => local.getNamedTokens('bad', ['DEMO'])).toThrow(/Invalid or expired/);
  });

  test('non-JSON verify response returns clear error', () => {
    const local = {};
    loadBroker(local, brokerScriptProperties(), function () {
      return {
        getResponseCode: function () {
          return 200;
        },
        getContentText: function () {
          return 'not json';
        },
      };
    });
    const json = readTextOutput(
      local.doPost({
        postData: {
          contents: JSON.stringify({
            action: 'getToken',
            code: 'c',
            names: ['DEMO'],
          }),
        },
        headers: {},
      })
    );
    expect(json.ok).toBe(false);
    expect(String(json.error)).toMatch(/non-JSON/);
  });

  test('missing AUTHENTICATOR_BASE_URL fails fast', () => {
    const p = brokerScriptProperties();
    delete p.AUTHENTICATOR_BASE_URL;
    const local = {};
    loadBroker(local, p, function () {
      return createStaticJsonResponse({ valid: true }, 200);
    });
    const json = readTextOutput(
      local.doPost({
        postData: {
          contents: JSON.stringify({
            action: 'getToken',
            code: 'c',
            names: ['DEMO'],
          }),
        },
        headers: {},
      })
    );
    expect(json.ok).toBe(false);
    expect(String(json.error)).toMatch(/AUTHENTICATOR_BASE_URL/);
  });

  test('HTTP surface: heartbeat, getPermission, validation', () => {
    const local = {};
    loadBroker(local, brokerScriptProperties(), function () {
      return createStaticJsonResponse({ valid: true }, 200);
    });
    expect(readTextOutput(local.doGet({ parameter: {} })).ok).toBe(true);
    const perm = readTextOutput(
      local.doGet({ parameter: { action: 'getPermission' } })
    );
    expect(perm.action).toBe('getPermission');
    expect(
      readTextOutput(
        local.doPost({
          postData: { contents: JSON.stringify({ action: 'nope' }) },
          headers: {},
        })
      ).error
    ).toMatch(/Unknown or missing action/);
    expect(
      readTextOutput(
        local.doPost({
          postData: {
            contents: JSON.stringify({ action: 'getToken', names: ['DEMO'] }),
          },
          headers: {},
        })
      ).error
    ).toMatch(/Missing code/);
    expect(
      readTextOutput(
        local.doPost({
          postData: {
            contents: JSON.stringify({
              action: 'getToken',
              code: 'c',
              names: [],
            }),
          },
          headers: {},
        })
      ).error
    ).toMatch(/Missing names/);
  });

  test('partial token names returns missing list', () => {
    const local = {};
    loadBroker(local, brokerScriptProperties(), function () {
      return createStaticJsonResponse({ valid: true }, 200);
    });
    const json = readTextOutput(
      local.doPost({
        postData: {
          contents: JSON.stringify({
            action: 'getToken',
            code: 'c',
            names: ['DEMO', 'MISSING'],
          }),
        },
        headers: {},
      })
    );
    expect(json.ok).toBe(false);
    expect(json.missing).toContain('MISSING');
  });
});
