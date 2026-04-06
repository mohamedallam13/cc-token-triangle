;(function (root, factory) {
  root.BROKER_APP = factory();
})(this, function () {
  function handleGet(e) {
    const q = e && e.parameter ? e.parameter : {};
    if (q.action === 'getPermission') {
      return jsonOutput(getPermissionPayload());
    }
    return jsonOutput({
      ok: true,
      service: BROKER_ENV.SERVICE_ID,
    });
  }
  function handlePost(event) {
    try {
      const body = parseJsonBody(event);
      if (body.action === 'getPermission') {
        return jsonOutput(getPermissionPayload());
      }
      if (body.action !== 'getToken') {
        return jsonOutput({
          error: 'Unknown or missing action (use getToken or getPermission)',
        });
      }
      if (!body.code) {
        return jsonOutput({ error: 'Missing code' });
      }
      if (!body.names || !body.names.length) {
        return jsonOutput({ error: 'Missing names' });
      }
      const result = runExchange(body.code, body.names);
      if (!result.ok) {
        return jsonOutput({ ok: false, error: result.error, missing: result.missing || [] });
      }
      return jsonOutput({
        ok: true,
        tokens: result.tokens,
        missing: result.missing,
      });
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      return jsonOutput({ ok: false, error: message });
    }
  }

  function jsonOutput(body) {
    const output = ContentService.createTextOutput(JSON.stringify(body));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  }
  function parseJsonBody(event) {
    const contents = event.postData && event.postData.contents;
    return BROKER_UTILS.parseJsonContents(contents, BROKER_ENV.MAX_BODY_BYTES);
  }
  function getPermissionPayload() {
    const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    return {
      ok: true,
      action: 'getPermission',
      service: BROKER_ENV.SERVICE_ID,
      scriptId: ScriptApp.getScriptId(),
      authStatus: String(info.getAuthorizationStatus()),
      oauthScopes: BROKER_ENV.OAUTH_SCOPES,
    };
  }
  function collectNamedTokens(props, names) {
    const out = {};
    const missing = [];
    const list = Array.isArray(names) ? names : [];
    const env = BROKER_ENV;
    const utils = BROKER_UTILS;
    for (let i = 0; i < list.length; i++) {
      const rawName = list[i];
      const key = utils.tokenPropertyKey(rawName, env.TOKEN_PREFIX);
      if (!key) {
        missing.push(String(rawName));
        continue;
      }
      const val = props.getProperty(key);
      if (val === null || val === '') {
        missing.push(String(rawName));
      } else {
        out[String(rawName)] = val;
      }
    }
    return { out: out, missing: missing };
  }
  function readBrokerConfig(props) {
    const env = BROKER_ENV;
    const base = props.getProperty(env.PROP_AUTHENTICATOR_BASE_URL);
    const secret = props.getProperty(env.PROP_AUTH_INTERNAL_SECRET);
    if (!base || !secret) {
      return {
        ok: false,
        error: 'AUTHENTICATOR_BASE_URL or AUTH_INTERNAL_SECRET not set',
      };
    }
    const verifyUrl = String(base).replace(/\s+/g, '');
    if (!verifyUrl) {
      return { ok: false, error: 'AUTHENTICATOR_BASE_URL is empty' };
    }
    return { ok: true, verifyUrl: verifyUrl, secret: secret };
  }
  function fetchVerifyOutcome(verifyUrl, code, secret) {
    const payload = JSON.stringify({ action: 'verify', code: String(code || '') });
    return UrlFetchApp.fetch(verifyUrl, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: payload,
      headers: {
        'X-Internal-Secret': secret,
      },
    });
  }
  function outcomeFromVerifyResponse(res) {
    const httpCode = res.getResponseCode();
    const text = res.getContentText() || '{}';
    let data = {};
    try {
      data = JSON.parse(text);
    } catch (err) {
      return { ok: false, error: 'Authenticator returned non-JSON' };
    }
    if (httpCode >= 400 || !data.valid) {
      return {
        ok: false,
        error: (data && data.error) || 'Code verification failed',
      };
    }
    return { ok: true };
  }
  function runExchange(rawCode, names) {
    const props = PropertiesService.getScriptProperties();
    const cfg = readBrokerConfig(props);
    if (!cfg.ok) {
      return cfg;
    }
    const res = fetchVerifyOutcome(cfg.verifyUrl, rawCode, cfg.secret);
    const gate = outcomeFromVerifyResponse(res);
    if (!gate.ok) {
      return gate;
    }
    const collected = collectNamedTokens(props, names);
    if (collected.missing.length > 0) {
      return {
        ok: false,
        error: 'Unknown token names: ' + collected.missing.join(', '),
        missing: collected.missing,
      };
    }
    return {
      ok: true,
      tokens: collected.out,
      missing: [],
    };
  }

  /** API Executable entry — no HTTP event; throws on error; domain restriction enforced by executionApi. */
  function handleExecGetTokens(code, names) {
    const result = runExchange(String(code || ''), Array.isArray(names) ? names : []);
    if (!result.ok) {
      throw new Error(result.error || 'Token exchange failed');
    }
    return { ok: true, tokens: result.tokens, missing: result.missing || [] };
  }

  return {
    handleGet,
    handlePost,
    handleExecGetTokens,
  };
});
