;(function (root, factory) {
  root.AUTH_APP = factory();
})(this, function () {
  function handleGet(e) {
    const q = e && e.parameter ? e.parameter : {};
    if (q.action === 'getPermission') {
      return jsonOutput(getPermissionPayload());
    }
    return jsonOutput({
      ok: true,
      service: AUTH_ENV.SERVICE_ID,
    });
  }
  function handlePost(event) {
    try {
      const body = parseJsonBody(event);
      const action = body.action;
      if (action === 'getPermission') {
        return jsonOutput(getPermissionPayload());
      }
      if (action === 'issue') {
        return jsonOutput(routeIssue(event).body);
      }
      if (action === 'verify') {
        return jsonOutput(routeVerify(event, body).body);
      }
      return jsonOutput({ error: 'Unknown or missing action' });
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      return jsonOutput({ error: message });
    }
  }

  function jsonOutput(body) {
    const output = ContentService.createTextOutput(JSON.stringify(body));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  }
  function parseJsonBody(event) {
    const contents = event.postData && event.postData.contents;
    return AUTH_UTILS.parseJsonContents(contents, AUTH_ENV.MAX_BODY_BYTES);
  }
  function getPermissionPayload() {
    const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    return {
      ok: true,
      action: 'getPermission',
      service: AUTH_ENV.SERVICE_ID,
      scriptId: ScriptApp.getScriptId(),
      authStatus: String(info.getAuthorizationStatus()),
      oauthScopes: AUTH_ENV.OAUTH_SCOPES,
    };
  }
  function issueNewCode(cache) {
    const code = Utilities.getUuid().replace(/-/g, '');
    const key = AUTH_UTILS.cacheKeyForCode(AUTH_ENV.CACHE_PREFIX, code);
    cache.put(key, '1', AUTH_ENV.CODE_TTL_SECONDS);
    return { code: code, expiresInSeconds: AUTH_ENV.CODE_TTL_SECONDS };
  }
  function checkIssueRateLimit(cache) {
    const bucket = Math.floor(Date.now() / 60000);
    const key = AUTH_ENV.ISSUE_RATE_KEY + String(bucket);
    const current = parseInt(cache.get(key) || '0', 10);
    if (current >= AUTH_ENV.ISSUE_RATE_MAX) {
      return { ok: false, error: 'Too many requests — try again shortly' };
    }
    cache.put(key, String(current + 1), 120);
    return { ok: true };
  }
  function checkCallerSecret(headers) {
    const expected = AUTH_ENV.getCallerSecret();
    if (!expected) {
      return { ok: true }; // not configured — skip check (backward compatible)
    }
    const provided = AUTH_UTILS.extractCallerSecret(headers);
    if (!provided || provided !== expected) {
      return { ok: false, error: 'Unauthorized' };
    }
    return { ok: true };
  }
  function verifyAndConsume(rawCode, headerSecret) {
    const expected = AUTH_ENV.getAuthInternalSecret();
    const gate = AUTH_UTILS.secretHeaderOutcome(expected, headerSecret);
    if (!gate.ok) {
      return gate;
    }
    const normalized = AUTH_UTILS.normalizeChallengeCode(rawCode);
    if (!normalized) {
      return { ok: false, error: 'Missing code' };
    }
    const cache = CacheService.getScriptCache();
    const key = AUTH_UTILS.cacheKeyForCode(AUTH_ENV.CACHE_PREFIX, normalized);
    const hit = cache.get(key);
    if (!hit) {
      return { ok: false, error: 'Invalid or expired code' };
    }
    cache.remove(key);
    return { ok: true };
  }
  function routeIssue(event) {
    const cache = CacheService.getScriptCache();
    const rateCheck = checkIssueRateLimit(cache);
    if (!rateCheck.ok) {
      return { body: { ok: false, error: rateCheck.error } };
    }
    const secretCheck = checkCallerSecret(event && event.headers);
    if (!secretCheck.ok) {
      return { body: { ok: false, error: secretCheck.error } };
    }
    const issued = issueNewCode(cache);
    return {
      body: {
        code: issued.code,
        expiresInSeconds: issued.expiresInSeconds,
      },
    };
  }
  function routeVerify(event, body) {
    const headerSecret = AUTH_UTILS.extractInternalSecretHeaderOnly(event.headers);
    const bodySecret =
      body && body.internalSecret != null && String(body.internalSecret) !== ''
        ? String(body.internalSecret)
        : '';
    const effective = headerSecret || bodySecret;
    const result = verifyAndConsume(body.code, effective);
    if (!result.ok) {
      return { body: { valid: false, error: result.error } };
    }
    return { body: { valid: true } };
  }

  /** API Executable entry — no HTTP event; throws on error; domain restriction enforced by executionApi. */
  function handleExecIssue() {
    const cache = CacheService.getScriptCache();
    const rateCheck = checkIssueRateLimit(cache);
    if (!rateCheck.ok) {
      throw new Error(rateCheck.error);
    }
    const issued = issueNewCode(cache);
    return { code: issued.code, expiresInSeconds: issued.expiresInSeconds };
  }

  return {
    handleGet,
    handlePost,
    handleExecIssue,
  };
});
