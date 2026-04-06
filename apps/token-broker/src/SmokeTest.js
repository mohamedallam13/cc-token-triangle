/**
 * SMOKE_TEST — UrlFetch to deployed Web app URLs only (authenticator + optional broker /exec).
 * Proves this broker project can reach the authenticator over the network.
 *
 * Script properties:
 *   AUTHENTICATOR_BASE_URL — authenticator Web app /exec (required)
 *   AUTH_INTERNAL_SECRET — broker ↔ auth (required)
 *   SMOKE_TEST_CALLER_SECRET — same value as authenticator CALLER_SECRET (required for issue)
 *   SMOKE_TEST_BROKER_EXEC_URL — this broker’s Web app /exec (optional; for end-to-end getToken)
 *   TOKEN_DEMO etc. must exist on broker for getToken to succeed
 *
 * Run: smokeTest_reachAuthenticator()  |  smokeTest_endToEndDeployed()
 *
 * Debug (broker vs auth): smokeTest_debugIssueAuthApi() |
 *   smokeTest_debugVerifyAfterApiIssue() — issue via Script API; verify via Web /exec.
 *   Use either full URLs or bare deployment ids (same values as tt-deploy-ids.json):
 *   SMOKE_DEBUG_AUTH_API_ISSUE_URL — full …/scripts/{API_EXECUTABLE_ID}:run
 *   SMOKE_DEBUG_AUTH_API_EXECUTABLE_ID — API Executable id only (builds the URL above)
 *   SMOKE_DEBUG_AUTH_WEB_EXEC_URL — full …/macros/s/{WEB_DEPLOYMENT_ID}/exec
 *   SMOKE_DEBUG_AUTH_WEB_DEPLOYMENT_ID — Web app deployment id only (builds /exec URL)
 *   AUTHENTICATOR_BASE_URL — if already Web /exec, used as verify URL when WEB_* omitted
 *   AUTH_INTERNAL_SECRET — must match authenticator
 *
 * End-to-end optional:
 *   SMOKE_TEST_BROKER_EXEC_URL — full broker /exec URL
 *   SMOKE_TEST_BROKER_WEB_DEPLOYMENT_ID — broker Web deployment id only (builds /exec URL)
 *
 * Full suite: smokeTest_runFullBattery() — runs all four smokes and returns one JSON string.
 */
;(function (root, factory) {
  root.BROKER_SMOKE = factory();
})(this, function () {
  function buildApiRunUrlFromExecutableId(id) {
    var s = String(id || '').trim();
    if (!s) return '';
    return 'https://script.googleapis.com/v1/scripts/' + s + ':run';
  }

  function buildWebExecUrlFromDeploymentId(id) {
    var s = String(id || '').trim();
    if (!s) return '';
    return 'https://script.google.com/macros/s/' + s + '/exec';
  }

  function tryParseJson(s) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return { _parseError: String(e), _raw: String(s).substring(0, 2000) };
    }
  }

  function postToExec(url, payload, headerMap) {
    var headers = {};
    var key;
    for (key in headerMap) {
      if (Object.prototype.hasOwnProperty.call(headerMap, key)) {
        headers[key] = headerMap[key];
      }
    }
    var u = String(url).trim();
    if (/^https:\/\/script\.google\.com\//i.test(u) && !headers.Authorization) {
      try {
        headers.Authorization = 'Bearer ' + ScriptApp.getOAuthToken();
      } catch (authErr) {
        console.log('[BROKER_SMOKE] no Bearer (optional)', String(authErr));
      }
    }
    console.log('[BROKER_SMOKE] POST', u.substring(0, 88) + '...', Object.keys(payload || {}));
    return UrlFetchApp.fetch(u, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify(payload || {}),
      headers: headers,
    });
  }

  /** UrlFetch authenticator: issue then verify — proves broker can talk to auth. */
  function runReachAuthenticator() {
    var props = PropertiesService.getScriptProperties();
    var authUrl = (props.getProperty('AUTHENTICATOR_BASE_URL') || '').trim();
    var internal = props.getProperty('AUTH_INTERNAL_SECRET');
    var caller = (props.getProperty('SMOKE_TEST_CALLER_SECRET') || '').trim();
    console.log('[BROKER_SMOKE] reachAuthenticator — AUTHENTICATOR_BASE_URL set:', !!authUrl);

    if (!authUrl || !internal || !caller) {
      var msg =
        'Set AUTHENTICATOR_BASE_URL, AUTH_INTERNAL_SECRET, SMOKE_TEST_CALLER_SECRET (same as authenticator CALLER_SECRET)';
      console.log('[BROKER_SMOKE] FAIL — ' + msg);
      return JSON.stringify({ ok: false, message: msg });
    }
    if (/script\.googleapis\.com/i.test(authUrl)) {
      var wrong =
        'AUTHENTICATOR_BASE_URL is the Script API URL — use Web app /exec (https://script.google.com/macros/s/…/exec), not script.googleapis.com/...:run. Client app script_api transport uses API; broker smoke uses web issue/verify only.';
      console.log('[BROKER_SMOKE] FAIL — ' + wrong);
      return JSON.stringify({ ok: false, message: wrong });
    }

    var issueRes = postToExec(
      authUrl,
      { action: 'issue', callerSecret: caller },
      {
        'X-Caller-Secret': caller,
      }
    );
    var issueHttp = issueRes.getResponseCode();
    var issueText = issueRes.getContentText() || '{}';
    console.log('[BROKER_SMOKE] auth issue HTTP', issueHttp, issueText.substring(0, 500));

    var issued;
    try {
      issued = JSON.parse(issueText);
    } catch (e1) {
      return JSON.stringify({
        ok: false,
        step: 'issue',
        http: issueHttp,
        raw: issueText.substring(0, 800),
      });
    }
    if (!issued.code) {
      return JSON.stringify({ ok: false, step: 'issue', http: issueHttp, body: issued });
    }

    var verifyRes = postToExec(
      authUrl,
      { action: 'verify', code: issued.code, internalSecret: internal },
      { 'X-Internal-Secret': internal }
    );
    var verifyHttp = verifyRes.getResponseCode();
    var verifyText = verifyRes.getContentText() || '{}';
    console.log('[BROKER_SMOKE] auth verify HTTP', verifyHttp, verifyText.substring(0, 500));

    var verified;
    try {
      verified = JSON.parse(verifyText);
    } catch (e2) {
      return JSON.stringify({
        ok: false,
        step: 'verify',
        http: verifyHttp,
        raw: verifyText.substring(0, 800),
      });
    }

    var out = {
      ok: verified.valid === true,
      step: 'broker_can_reach_authenticator',
      issueHttp: issueHttp,
      verifyHttp: verifyHttp,
      verify: verified,
    };
    console.log('[BROKER_SMOKE] reachAuthenticator summary', JSON.stringify(out));
    return JSON.stringify(out);
  }

  /** One issue on auth → getToken on broker /exec (broker verifies code with auth internally). */
  function runEndToEndDeployed() {
    var props = PropertiesService.getScriptProperties();
    var brokerExec = (props.getProperty('SMOKE_TEST_BROKER_EXEC_URL') || '').trim();
    if (!brokerExec) {
      brokerExec = buildWebExecUrlFromDeploymentId(
        props.getProperty('SMOKE_TEST_BROKER_WEB_DEPLOYMENT_ID')
      );
    }
    var authUrl = (props.getProperty('AUTHENTICATOR_BASE_URL') || '').trim();
    var caller = (props.getProperty('SMOKE_TEST_CALLER_SECRET') || '').trim();
    console.log('[BROKER_SMOKE] endToEnd — broker exec set:', !!brokerExec, 'auth url set:', !!authUrl);

    if (!brokerExec || !authUrl || !caller) {
      var msg0 =
        'Set SMOKE_TEST_BROKER_EXEC_URL or SMOKE_TEST_BROKER_WEB_DEPLOYMENT_ID, AUTHENTICATOR_BASE_URL, SMOKE_TEST_CALLER_SECRET';
      console.log('[BROKER_SMOKE] endToEnd FAIL — ' + msg0);
      return JSON.stringify({ ok: false, message: msg0 });
    }
    if (/script\.googleapis\.com/i.test(authUrl)) {
      var bad =
        'AUTHENTICATOR_BASE_URL must be Web app /exec, not script.googleapis.com (see reachAuthenticator guard).';
      console.log('[BROKER_SMOKE] endToEnd FAIL — ' + bad);
      return JSON.stringify({ ok: false, message: bad });
    }

    var issueRes = postToExec(
      authUrl,
      { action: 'issue', callerSecret: caller },
      { 'X-Caller-Secret': caller }
    );
    console.log('[BROKER_SMOKE] e2e issue HTTP', issueRes.getResponseCode());
    var issued = JSON.parse(issueRes.getContentText() || '{}');
    if (!issued.code) {
      return JSON.stringify({ ok: false, step: 'issue_e2e', body: issued });
    }

    var tokRes = postToExec(
      brokerExec,
      { action: 'getToken', code: issued.code, names: ['DEMO'] },
      {}
    );
    var tokHttp = tokRes.getResponseCode();
    var tokText = tokRes.getContentText() || '{}';
    console.log('[BROKER_SMOKE] broker getToken HTTP', tokHttp, tokText.substring(0, 600));

    var tok;
    try {
      tok = JSON.parse(tokText);
    } catch (e3) {
      return JSON.stringify({
        ok: false,
        step: 'getToken',
        http: tokHttp,
        raw: tokText.substring(0, 800),
      });
    }

    var summary = {
      ok: tok.ok === true,
      step: 'end_to_end_deployed_urls',
      getTokenHttp: tokHttp,
      tokens: tok.tokens,
      missing: tok.missing,
      error: tok.error,
    };
    console.log('[BROKER_SMOKE] endToEnd summary', JSON.stringify(summary));
    return JSON.stringify(summary);
  }

  /** Same as BrokerApp.fetchVerifyOutcome — header + body.internalSecret (Web app may drop headers). */
  function verifyWebBrokerStyle(authExecUrl, code, internalSecret) {
    var payload = JSON.stringify({
      action: 'verify',
      code: String(code || ''),
      internalSecret: internalSecret,
    });
    return UrlFetchApp.fetch(String(authExecUrl).trim(), {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: payload,
      headers: { 'X-Internal-Secret': internalSecret },
    });
  }

  /** Optional Bearer for script.google.com /exec (differs from BrokerApp). */
  function verifyWebWithBearer(authExecUrl, code, internalSecret) {
    var headers = { 'X-Internal-Secret': internalSecret };
    try {
      headers.Authorization = 'Bearer ' + ScriptApp.getOAuthToken();
    } catch (ignore) {}
    var payload = JSON.stringify({
      action: 'verify',
      code: String(code || ''),
      internalSecret: internalSecret,
    });
    return UrlFetchApp.fetch(String(authExecUrl).trim(), {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: payload,
      headers: headers,
    });
  }

  function issueAuthApiRaw() {
    var props = PropertiesService.getScriptProperties();
    var apiUrl = (props.getProperty('SMOKE_DEBUG_AUTH_API_ISSUE_URL') || '').trim();
    if (!apiUrl) {
      apiUrl = buildApiRunUrlFromExecutableId(
        props.getProperty('SMOKE_DEBUG_AUTH_API_EXECUTABLE_ID')
      );
    }
    if (!apiUrl) {
      var err =
        'Set SMOKE_DEBUG_AUTH_API_ISSUE_URL (full …:run URL) or SMOKE_DEBUG_AUTH_API_EXECUTABLE_ID (bare API Executable id)';
      console.log('[BROKER_SMOKE] issueAuthApiRaw — ' + err);
      return { http: 0, raw: JSON.stringify({ error: err }) };
    }
    var res = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({
        function: 'issueCode',
        parameters: [],
        devMode: false,
      }),
    });
    var http = res.getResponseCode();
    var text = res.getContentText() || '';
    console.log('[BROKER_SMOKE] issue API HTTP', http);
    console.log('[BROKER_SMOKE] issue API body', text);
    return { http: http, raw: text };
  }

  function parseCodeFromIssueApiBody(text) {
    try {
      var env = JSON.parse(text || '{}');
      if (env.response && env.response.result && env.response.result.code) {
        return String(env.response.result.code);
      }
    } catch (e) {
      console.log('[BROKER_SMOKE] parse issue API', String(e));
    }
    return '';
  }

  function debugVerifyAfterApiIssue() {
    var props = PropertiesService.getScriptProperties();
    var propUrl = (props.getProperty('AUTHENTICATOR_BASE_URL') || '').trim();
    var internal = (props.getProperty('AUTH_INTERNAL_SECRET') || '').trim();
    var verifyUrl = (props.getProperty('SMOKE_DEBUG_AUTH_WEB_EXEC_URL') || '').trim();
    if (!verifyUrl && /^https:\/\/script\.google\.com\/macros\//i.test(propUrl)) {
      verifyUrl = propUrl;
    }
    if (!internal) {
      console.log('[BROKER_SMOKE] debugVerify — set AUTH_INTERNAL_SECRET');
      return JSON.stringify({ ok: false, message: 'Set AUTH_INTERNAL_SECRET' });
    }
    if (!verifyUrl) {
      verifyUrl = buildWebExecUrlFromDeploymentId(
        props.getProperty('SMOKE_DEBUG_AUTH_WEB_DEPLOYMENT_ID')
      );
    }
    if (!verifyUrl) {
      var hint =
        'Set SMOKE_DEBUG_AUTH_WEB_EXEC_URL, SMOKE_DEBUG_AUTH_WEB_DEPLOYMENT_ID, or AUTHENTICATOR_BASE_URL (Web /exec)';
      console.log('[BROKER_SMOKE] debugVerify — ' + hint);
      return JSON.stringify({ ok: false, message: hint });
    }
    console.log('[BROKER_SMOKE] verify target (Web /exec):', verifyUrl);
    console.log(
      '[BROKER_SMOKE] prop AUTHENTICATOR_BASE_URL len',
      propUrl.length,
      /script\.googleapis\.com/i.test(propUrl) ? '← API shape — use Web /exec for verify' : ''
    );

    console.log(
      '[BROKER_SMOKE] two API issues — codes are one-time; second verify needs a fresh code'
    );

    var issued1 = issueAuthApiRaw();
    var code1 = parseCodeFromIssueApiBody(issued1.raw);
    if (!code1) {
      console.log('[BROKER_SMOKE] no code from issue API — stop');
      return JSON.stringify({ step: 'issue_api', http: issued1.http, raw: issued1.raw });
    }

    var r1 = verifyWebBrokerStyle(verifyUrl, code1, internal);
    console.log('[BROKER_SMOKE] verify BROKER_STYLE (no Bearer) HTTP', r1.getResponseCode());
    console.log('[BROKER_SMOKE] verify BROKER_STYLE body', r1.getContentText());

    var issued2 = issueAuthApiRaw();
    var code2 = parseCodeFromIssueApiBody(issued2.raw);
    if (!code2) {
      return JSON.stringify({ step: 'issue_api_2', http: issued2.http, raw: issued2.raw });
    }

    var r2 = verifyWebWithBearer(verifyUrl, code2, internal);
    console.log('[BROKER_SMOKE] verify WITH_BEARER HTTP', r2.getResponseCode());
    console.log('[BROKER_SMOKE] verify WITH_BEARER body', r2.getContentText());

    var j1 = {};
    var j2 = {};
    try {
      j1 = JSON.parse(r1.getContentText() || '{}');
    } catch (e1) {}
    try {
      j2 = JSON.parse(r2.getContentText() || '{}');
    } catch (e2) {}
    return JSON.stringify({
      ok: j1.valid === true && j2.valid === true,
      verifyBrokerValid: j1.valid,
      verifyBearerValid: j2.valid,
    });
  }

  /**
   * Runs all four smoke entry points in order; returns one JSON string for Logs.
   * Steps 3–4 need SMOKE_DEBUG_* URLs or *_EXECUTABLE_ID / *_DEPLOYMENT_ID properties.
   */
  function runFullBattery() {
    var report = {
      step1_reachAuthenticator: tryParseJson(runReachAuthenticator()),
      step2_endToEnd: tryParseJson(runEndToEndDeployed()),
      step3_debugIssueAuthApi: issueAuthApiRaw(),
      step4_debugVerifyAfterApiIssue: tryParseJson(debugVerifyAfterApiIssue()),
    };
    var s1 = report.step1_reachAuthenticator;
    var s2 = report.step2_endToEnd;
    var s3 = report.step3_debugIssueAuthApi;
    var s4 = report.step4_debugVerifyAfterApiIssue;
    report.summary = {
      reachAuthenticatorOk: !!(s1 && s1.ok === true),
      endToEndOk: !!(s2 && s2.ok === true),
      debugIssueAuthApiOk: !!(s3 && Number(s3.http) === 200),
      debugVerifyAfterApiIssueOk: !!(s4 && s4.ok === true),
      allFourOk: false,
    };
    report.summary.allFourOk =
      report.summary.reachAuthenticatorOk &&
      report.summary.endToEndOk &&
      report.summary.debugIssueAuthApiOk &&
      report.summary.debugVerifyAfterApiIssueOk;
    console.log('[BROKER_SMOKE] full battery summary', JSON.stringify(report.summary));
    return JSON.stringify(report, null, 2);
  }

  return {
    runReachAuthenticator: runReachAuthenticator,
    runEndToEndDeployed: runEndToEndDeployed,
    issueAuthApiRaw: issueAuthApiRaw,
    debugVerifyAfterApiIssue: debugVerifyAfterApiIssue,
    runFullBattery: runFullBattery,
  };
});

function smokeTest_reachAuthenticator() {
  return BROKER_SMOKE.runReachAuthenticator();
}

function smokeTest_endToEndDeployed() {
  return BROKER_SMOKE.runEndToEndDeployed();
}

function smokeTest_debugIssueAuthApi() {
  return BROKER_SMOKE.issueAuthApiRaw();
}

/** Issue via Script API, then verify via web: logs broker-style vs Bearer (compare to BrokerApp). */
function smokeTest_debugVerifyAfterApiIssue() {
  return BROKER_SMOKE.debugVerifyAfterApiIssue();
}

/** Runs smokeTest_reachAuthenticator → endToEnd → debugIssueAuthApi → debugVerifyAfterApiIssue; one JSON report. */
function smokeTest_runFullBattery() {
  return BROKER_SMOKE.runFullBattery();
}
