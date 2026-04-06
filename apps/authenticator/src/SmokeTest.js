/**
 * SMOKE_TEST — UrlFetch only against your deployed Web app /exec URL (not in-process doPost).
 * Script properties: SMOKE_TEST_EXEC_URL, CALLER_SECRET, AUTH_INTERNAL_SECRET
 * Run: smokeTest_runUrlFetch()
 */
;(function (root, factory) {
  root.AUTH_SMOKE = factory();
})(this, function () {
  function postToExec(execUrl, payload, headerMap) {
    var headers = {};
    var key;
    for (key in headerMap) {
      if (Object.prototype.hasOwnProperty.call(headerMap, key)) {
        headers[key] = headerMap[key];
      }
    }
    var url = String(execUrl).trim();
    if (/^https:\/\/script\.google\.com\//i.test(url) && !headers.Authorization) {
      try {
        headers.Authorization = 'Bearer ' + ScriptApp.getOAuthToken();
      } catch (authErr) {
        console.log('[AUTH_SMOKE] no Bearer (optional)', String(authErr));
      }
    }
    console.log('[AUTH_SMOKE] POST', url.substring(0, 80) + '...', 'keys', Object.keys(payload || {}));
    return UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify(payload || {}),
      headers: headers,
    });
  }

  function runUrlFetchAgainstDeployedExec() {
    var props = PropertiesService.getScriptProperties();
    var execUrl = (props.getProperty('SMOKE_TEST_EXEC_URL') || '').trim();
    var caller = props.getProperty('CALLER_SECRET');
    var internal = props.getProperty('AUTH_INTERNAL_SECRET');
    console.log('[AUTH_SMOKE] start — SMOKE_TEST_EXEC_URL set:', !!execUrl);

    if (!execUrl || !caller || !internal) {
      var msg =
        'Set SMOKE_TEST_EXEC_URL (this project Web app /exec URL), CALLER_SECRET, AUTH_INTERNAL_SECRET';
      console.log('[AUTH_SMOKE] FAIL — ' + msg);
      return JSON.stringify({ ok: false, message: msg });
    }

    var issueHttp = postToExec(execUrl, { action: 'issue' }, {
      'X-Caller-Secret': caller,
    });
    var issueCode = issueHttp.getResponseCode();
    var issueText = issueHttp.getContentText() || '{}';
    console.log('[AUTH_SMOKE] issue response HTTP', issueCode, issueText.substring(0, 500));

    var issued;
    try {
      issued = JSON.parse(issueText);
    } catch (parseErr) {
      console.log('[AUTH_SMOKE] issue JSON parse error', String(parseErr));
      return JSON.stringify({
        ok: false,
        step: 'issue',
        http: issueCode,
        raw: issueText.substring(0, 800),
      });
    }
    if (!issued.code) {
      return JSON.stringify({ ok: false, step: 'issue', http: issueCode, body: issued });
    }

    var verifyHttp = postToExec(
      execUrl,
      { action: 'verify', code: issued.code },
      { 'X-Internal-Secret': internal }
    );
    var verifyCode = verifyHttp.getResponseCode();
    var verifyText = verifyHttp.getContentText() || '{}';
    console.log('[AUTH_SMOKE] verify response HTTP', verifyCode, verifyText.substring(0, 500));

    var verified;
    try {
      verified = JSON.parse(verifyText);
    } catch (parseErr2) {
      return JSON.stringify({
        ok: false,
        step: 'verify',
        http: verifyCode,
        raw: verifyText.substring(0, 800),
      });
    }

    var summary = {
      ok: verified.valid === true,
      issueHttp: issueCode,
      verifyHttp: verifyCode,
      expiresInSeconds: issued.expiresInSeconds,
      verify: verified,
    };
    console.log('[AUTH_SMOKE] summary', JSON.stringify(summary));
    return JSON.stringify(summary);
  }

  return {
    runUrlFetchAgainstDeployedExec: runUrlFetchAgainstDeployedExec,
  };
});

/** Select this in the Run menu — uses UrlFetch → your deployed /exec URL only. */
function smokeTest_runUrlFetch() {
  return AUTH_SMOKE.runUrlFetchAgainstDeployedExec();
}
