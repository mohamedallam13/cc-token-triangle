const path = require('path');
const { installSampleCallerGasFakes } = require('./vm-fakes/installSampleCaller');
const { runFilesInSandbox, sampleCallerChain } = require('./loadGasSandbox');
const {
  createStaticJsonResponse,
  createRecordingUrlFetchApp,
  createSequenceUrlFetchApp,
} = require('./vm-fakes/fakeUrlFetchApp');
const {
  OPS,
  sampleCallerWebWebProperties,
  sampleCallerApiApiProperties,
} = require('./fixtures/opsProperties');

const CALLER_ROOT = path.join(__dirname, '../sample-caller/src');

/** Wraps result in Apps Script Execution API envelope. */
function execApiResponse(result) {
  return createStaticJsonResponse(
    {
      done: true,
      response: {
        '@type':
          'type.googleapis.com/google.apps.script.v1.ExecutionResponse',
        result: result,
      },
    },
    200
  );
}

function loadCaller(sandbox, props, urlFetchAppOrHandler) {
  installSampleCallerGasFakes(sandbox, props, urlFetchAppOrHandler);
  runFilesInSandbox(sandbox, sampleCallerChain(CALLER_ROOT));
}

describe('Sample caller — client flow (TOKEN_CLIENT + props)', () => {
  test('webapp + webapp: issue then getToken; URLs and payloads match operations', () => {
    let step = 0;
    const rec = createRecordingUrlFetchApp(function () {
      step += 1;
      if (step === 1) {
        return createStaticJsonResponse(
          { code: 'issued-from-auth', expiresInSeconds: 60 },
          200
        );
      }
      return createStaticJsonResponse(
        { ok: true, tokens: { DEMO: 'tok-from-broker' }, missing: [] },
        200
      );
    });
    const sandbox = {};
    loadCaller(sandbox, sampleCallerWebWebProperties(), rec.UrlFetchApp);
    const result = sandbox.TOKEN_CLIENT.fetchNamedTokens(['DEMO']);
    expect(result.broker.ok).toBe(true);
    expect(result.broker.tokens.DEMO).toBe('tok-from-broker');
    const calls = rec.getCalls();
    expect(calls.length).toBe(2);
    expect(calls[0].url).toBe(OPS.AUTHENTICATOR_WEB_EXEC);
    const issueBody = JSON.parse(calls[0].payload);
    expect(issueBody.action).toBe('issue');
    expect(calls[0].headers['X-Caller-Secret']).toBe(OPS.CALLER_SECRET);
    expect(String(calls[0].headers.Authorization || '')).toMatch(/^Bearer /);
    expect(calls[1].url).toBe(OPS.BROKER_WEB_EXEC);
    const gtBody = JSON.parse(calls[1].payload);
    expect(gtBody.action).toBe('getToken');
    expect(gtBody.code).toBe('issued-from-auth');
    expect(gtBody.names).toEqual(['DEMO']);
  });

  test('script_api + script_api: Execution API envelopes and :run URLs', () => {
    const seq = createSequenceUrlFetchApp([
      function () {
        return execApiResponse({ code: 'api-code', expiresInSeconds: 60 });
      },
      function () {
        return execApiResponse({
          ok: true,
          tokens: { DEMO: 'api-tok' },
          missing: [],
        });
      },
    ]);
    const sandbox = {};
    loadCaller(sandbox, sampleCallerApiApiProperties(), seq);
    const result = sandbox.TOKEN_CLIENT.fetchNamedTokens(['DEMO']);
    expect(result.broker.tokens.DEMO).toBe('api-tok');
  });

  test('runSample reads DEMO_TOKEN_NAMES and chains fetchNamedTokens', () => {
    const seq = createSequenceUrlFetchApp([
      function () {
        return createStaticJsonResponse(
          { code: 'c1', expiresInSeconds: 60 },
          200
        );
      },
      function () {
        return createStaticJsonResponse(
          { ok: true, tokens: { DEMO: 'x' }, missing: [] },
          200
        );
      },
    ]);
    const sandbox = {};
    loadCaller(sandbox, sampleCallerWebWebProperties(), seq);
    const summary = sandbox.runSample();
    expect(summary.broker.tokens.DEMO).toBe('x');
  });

  test('webapp transport rejects AUTHENTICATOR_URL pointing at script.googleapis.com', () => {
    const sandbox = {};
    installSampleCallerGasFakes(
      sandbox,
      {
        ...sampleCallerWebWebProperties(),
        AUTHENTICATOR_URL: OPS.AUTH_API_RUN,
      },
      createStaticJsonResponse({}, 200)
    );
    runFilesInSandbox(sandbox, sampleCallerChain(CALLER_ROOT));
    expect(() => sandbox.TOKEN_CLIENT.fetchNamedTokens(['DEMO'])).toThrow(
      /AUTHENTICATOR_URL.*Web app/
    );
  });

  test('getPermission returns metadata', () => {
    const sandbox = {};
    loadCaller(
      sandbox,
      sampleCallerWebWebProperties(),
      function () {
        return createStaticJsonResponse({}, 200);
      }
    );
    const row = sandbox.getPermission();
    expect(row.ok).toBe(true);
    expect(row.action).toBe('getPermission');
    expect(row.service).toBe('cc-token-triangle-sample-caller');
  });
});
