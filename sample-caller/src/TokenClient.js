// Reusable client: copy this file into any script project. See AGENTS.md.
//
// Script Properties (File → Project settings → Script properties):
//   AUTHENTICATOR_TRANSPORT, TOKEN_BROKER_TRANSPORT — webapp | script_api
//   AUTHENTICATOR_URL, TOKEN_BROKER_URL — for webapp: https://script.google.com/macros/s/…/exec only (not …googleapis.com…:run)
//   AUTHENTICATOR_API_DEPLOYMENT_ID, TOKEN_BROKER_API_DEPLOYMENT_ID — optional if URL empty (legacy)
//   CALLER_SECRET — sent as X-Caller-Secret to authenticator (webapp)
//   DEMO_TOKEN_NAMES — comma-separated names (read in main.js, not only here)
//   TOKEN_CLIENT_LOG_TRANSPORTS — set "true" for extra endpoint-shape hints
//   TOKEN_CLIENT_VERBOSE — set "true" to Logger.log every step (or pass { verbose: true } to fetchNamedTokens)
;(function (root, factory) {
  root.TOKEN_CLIENT = factory();
})(this, function () {
  function normalizeTransport(rawValue) {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'webapp' || normalized === 'web') {
      return 'webapp';
    }
    if (
      normalized === 'script_api' ||
      normalized === 'api' ||
      normalized === 'apps_script_api'
    ) {
      return 'script_api';
    }
    throw new Error(
      'AUTHENTICATOR_TRANSPORT / TOKEN_BROKER_TRANSPORT must be webapp or script_api. Got: ' +
        rawValue
    );
  }

  /**
   * Script property already holds the API target: either the full :run URL from Google,
   * or a bare deployment id — only then we prepend the standard Apps Script API path.
   */
  function scriptApiRunUrlFromProperty(rawEndpoint) {
    const trimmed = String(rawEndpoint).trim();
    if (/^https:\/\/script\.googleapis\.com\//i.test(trimmed)) {
      return trimmed;
    }
    return 'https://script.googleapis.com/v1/scripts/' + trimmed + ':run';
  }

  function getAuthenticatorEndpointRaw(props) {
    return (
      props.getProperty('AUTHENTICATOR_URL') ||
      props.getProperty('AUTHENTICATOR_API_DEPLOYMENT_ID') ||
      ''
    );
  }

  function getBrokerEndpointRaw(props) {
    return (
      props.getProperty('TOKEN_BROKER_URL') ||
      props.getProperty('TOKEN_BROKER_API_DEPLOYMENT_ID') ||
      ''
    );
  }

  /** Webapp transport must use Deploy → Web app /exec, not Execution API :run URLs. */
  function assertWebTransportEndpoints(
    authTransport,
    brokerTransport,
    authUrl,
    brokerUrl
  ) {
    if (normalizeTransport(authTransport) === 'webapp') {
      const u = String(authUrl || '').trim();
      if (u && /script\.googleapis\.com/i.test(u)) {
        throw new Error(
          'AUTHENTICATOR_URL: use Web app https://script.google.com/macros/s/…/exec, not script.googleapis.com/…:run (or set AUTHENTICATOR_TRANSPORT to script_api).'
        );
      }
    }
    if (normalizeTransport(brokerTransport) === 'webapp') {
      const u = String(brokerUrl || '').trim();
      if (u && /script\.googleapis\.com/i.test(u)) {
        throw new Error(
          'TOKEN_BROKER_URL: use Web app https://script.google.com/macros/s/…/exec, not script.googleapis.com/…:run (or set TOKEN_BROKER_TRANSPORT to script_api).'
        );
      }
    }
  }

  function describeEndpointShapeForLog(rawEndpoint) {
    const text = String(rawEndpoint || '');
    if (/\/exec\b/i.test(text)) {
      return 'endpoint looks like web app (/exec)';
    }
    if (/script\.googleapis\.com/i.test(text) && /:run/.test(text)) {
      return 'endpoint looks like Apps Script API (:run URL)';
    }
    const trimmed = text.trim();
    if (/^AKfyc[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return 'endpoint looks like bare deployment id';
    }
    return 'endpoint shape not classified';
  }

  function traceLog(enabled, message) {
    if (!enabled) {
      return;
    }
    const line = '[TOKEN_CLIENT] ' + message;
    try {
      if (typeof Logger !== 'undefined' && Logger.log) {
        Logger.log(line);
      }
    } catch (ignore) {}
    try {
      if (typeof console !== 'undefined' && console.log) {
        console.log(line);
      }
    } catch (ignore2) {}
  }

  function previewUrl(url) {
    const s = String(url || '');
    if (s.length <= 72) {
      return s;
    }
    return s.slice(0, 72) + '…';
  }

  function isVerbose(props, options) {
    if (options && options.verbose === true) {
      return true;
    }
    return props.getProperty('TOKEN_CLIENT_VERBOSE') === 'true';
  }

  function logTransportsIfEnabled(
    authenticatorLabel,
    brokerLabel,
    authenticatorEndpointRaw,
    brokerEndpointRaw
  ) {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('TOKEN_CLIENT_LOG_TRANSPORTS') !== 'true') {
      return;
    }
    Logger.log(
      '[TOKEN_CLIENT] authenticator transport: ' +
        authenticatorLabel +
        ' | broker transport: ' +
        brokerLabel
    );
    Logger.log('[TOKEN_CLIENT] ' + describeEndpointShapeForLog(authenticatorEndpointRaw));
    Logger.log('[TOKEN_CLIENT] ' + describeEndpointShapeForLog(brokerEndpointRaw));
  }

  function fetchNamedTokens(names, options) {
    const props = PropertiesService.getScriptProperties();
    const verbose = isVerbose(props, options || {});
    traceLog(verbose, 'start — token names: ' + JSON.stringify(names));

    const authenticatorTransport = normalizeTransport(
      props.getProperty('AUTHENTICATOR_TRANSPORT')
    );
    const brokerTransport = normalizeTransport(props.getProperty('TOKEN_BROKER_TRANSPORT'));
    const authenticatorEndpointRaw = getAuthenticatorEndpointRaw(props);
    const brokerEndpointRaw = getBrokerEndpointRaw(props);
    if (!authenticatorEndpointRaw || !brokerEndpointRaw) {
      throw new Error(
        'Set AUTHENTICATOR_URL and TOKEN_BROKER_URL (and AUTHENTICATOR_TRANSPORT / TOKEN_BROKER_TRANSPORT).'
      );
    }

    traceLog(
      verbose,
      'step 1/5 — transports: auth=' +
        authenticatorTransport +
        ' broker=' +
        brokerTransport
    );
    traceLog(verbose, 'step 1/5 — auth URL: ' + previewUrl(authenticatorEndpointRaw));
    traceLog(verbose, 'step 1/5 — broker URL: ' + previewUrl(brokerEndpointRaw));

    logTransportsIfEnabled(
      authenticatorTransport,
      brokerTransport,
      authenticatorEndpointRaw,
      brokerEndpointRaw
    );

    assertWebTransportEndpoints(
      authenticatorTransport,
      brokerTransport,
      authenticatorEndpointRaw,
      brokerEndpointRaw
    );

    const callerSecret = props.getProperty('CALLER_SECRET') || '';
    traceLog(
      verbose,
      'step 2/5 — CALLER_SECRET ' + (callerSecret ? 'set (hidden)' : 'empty')
    );
    const issueHeaders = callerSecret ? { 'X-Caller-Secret': callerSecret } : {};
    const oauthToken = ScriptApp.getOAuthToken();

    let issueCode;
    let issueExpiresInSeconds;
    let httpIssue;

    if (authenticatorTransport === 'webapp') {
      traceLog(verbose, 'step 3/5 — issue: POST JSON {action:issue} to authenticator /exec');
      const issueResponse = postJson(
        authenticatorEndpointRaw,
        { action: 'issue' },
        issueHeaders
      );
      httpIssue = issueResponse.httpCode;
      traceLog(verbose, 'step 3/5 — issue HTTP ' + httpIssue);
      if (!issueResponse.json.code) {
        throw new Error('Issue failed: ' + issueResponse.raw);
      }
      issueCode = issueResponse.json.code;
      issueExpiresInSeconds = issueResponse.json.expiresInSeconds;
      traceLog(
        verbose,
        'step 3/5 — got challenge code (len ' +
          String(issueCode).length +
          '), expiresInSeconds=' +
          String(issueExpiresInSeconds)
      );
    } else {
      traceLog(verbose, 'step 3/5 — issue: Script API issueCode()');
      const issueResult = callScriptApi(
        authenticatorEndpointRaw,
        'issueCode',
        [],
        oauthToken
      );
      httpIssue = 200;
      if (!issueResult.code) {
        throw new Error('issueCode returned no code: ' + JSON.stringify(issueResult));
      }
      issueCode = issueResult.code;
      issueExpiresInSeconds = issueResult.expiresInSeconds;
      traceLog(
        verbose,
        'step 3/5 — got challenge code (len ' +
          String(issueCode).length +
          '), expiresInSeconds=' +
          String(issueExpiresInSeconds)
      );
    }

    let brokerBody;
    let httpBroker;

    if (brokerTransport === 'webapp') {
      traceLog(
        verbose,
        'step 4/5 — getToken: POST JSON {action,getToken,code,names} to broker /exec'
      );
      const brokerResponse = postJson(brokerEndpointRaw, {
        action: 'getToken',
        code: issueCode,
        names: names,
      });
      httpBroker = brokerResponse.httpCode;
      brokerBody = brokerResponse.json;
      traceLog(verbose, 'step 4/5 — broker HTTP ' + httpBroker);
    } else {
      traceLog(verbose, 'step 4/5 — getToken: Script API getNamedTokens(code, names)');
      brokerBody = callScriptApi(
        brokerEndpointRaw,
        'getNamedTokens',
        [issueCode, names],
        oauthToken
      );
      httpBroker = 200;
      traceLog(verbose, 'step 4/5 — broker Script API OK');
    }

    const out = {
      httpIssue: httpIssue,
      httpBroker: httpBroker,
      issued: { expiresInSeconds: issueExpiresInSeconds },
      broker: brokerBody,
    };
    traceLog(
      verbose,
      'step 5/5 — final: ' +
        JSON.stringify({
          httpIssue: out.httpIssue,
          httpBroker: out.httpBroker,
          issued: out.issued,
          brokerOk: brokerBody && brokerBody.ok,
          brokerError: brokerBody && brokerBody.error,
          tokenKeys:
            brokerBody && brokerBody.tokens
              ? Object.keys(brokerBody.tokens)
              : [],
          missing: brokerBody && brokerBody.missing,
        })
    );
    return out;
  }

  /** Same as main.js pattern: DEMO_TOKEN_NAMES from Script Properties, default DEMO. */
  function fetchNamedTokensFromProperties() {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('DEMO_TOKEN_NAMES');
    const fallback = raw == null || String(raw).trim() === '' ? 'DEMO' : raw;
    return fetchNamedTokens(parseCommaNames(fallback));
  }

  function parseCommaNames(raw) {
    return String(raw || '')
      .split(',')
      .map(function (segment) {
        return segment.trim();
      })
      .filter(function (segment) {
        return segment.length > 0;
      });
  }

  function summarizeScriptApiError(errorPayload) {
    if (!errorPayload) {
      return 'Unknown Script API error';
    }
    if (
      typeof errorPayload.message === 'string' &&
      errorPayload.message.trim() !== ''
    ) {
      return errorPayload.message;
    }
    const details = errorPayload.details;
    if (details && details.length) {
      for (let index = 0; index < details.length; index++) {
        const detail = details[index];
        if (!detail || detail.errorMessage == null) {
          continue;
        }
        if (typeof detail.errorMessage === 'string') {
          return detail.errorMessage;
        }
        try {
          return JSON.stringify(detail.errorMessage);
        } catch (nestedError) {
          continue;
        }
      }
    }
    try {
      return JSON.stringify(errorPayload);
    } catch (stringifyError) {
      return String(errorPayload);
    }
  }

  function callScriptApi(rawEndpointFromProperty, functionName, parameters, oauthToken) {
    const runUrl = scriptApiRunUrlFromProperty(rawEndpointFromProperty);
    const httpResponse = UrlFetchApp.fetch(runUrl, {
      method: 'post',
      headers: { Authorization: 'Bearer ' + oauthToken },
      contentType: 'application/json',
      payload: JSON.stringify({
        function: functionName,
        parameters: parameters,
        devMode: false,
      }),
      muteHttpExceptions: true,
    });
    const bodyText = httpResponse.getContentText() || '{}';
    let envelope;
    try {
      envelope = JSON.parse(bodyText);
    } catch (parseError) {
      throw new Error('Exec API response not JSON: ' + bodyText);
    }
    if (envelope.error) {
      const message = summarizeScriptApiError(envelope.error);
      const hint =
        envelope.error.code === 404
          ? ' Use API Executable deployment IDs (Deploy → Manage deployments), not the script project ID.'
          : '';
      throw new Error('Script API error: ' + message + hint);
    }
    return envelope.response ? envelope.response.result : {};
  }

  function postJson(requestUrl, payload, extraHeaders) {
    const headers = Object.assign({}, extraHeaders || {});
    const trimmedUrl = String(requestUrl).trim();
    if (/^https:\/\/script\.google\.com\//i.test(trimmedUrl) && !headers.Authorization) {
      try {
        headers.Authorization = 'Bearer ' + ScriptApp.getOAuthToken();
      } catch (authError) {
        /* ignore */
      }
    }
    const httpResponse = UrlFetchApp.fetch(trimmedUrl, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify(payload),
      headers: headers,
    });
    const statusCode = httpResponse.getResponseCode();
    const bodyText = httpResponse.getContentText() || '{}';
    let parsedBody = {};
    try {
      parsedBody = JSON.parse(bodyText);
    } catch (parseError) {
      const isHtml = /<!DOCTYPE\s+html/i.test(bodyText) || /<html[\s>]/i.test(bodyText);
      const hint = isHtml
        ? ' Server returned HTML (often Drive “unable to open” or sign-in). Fix: use exact https://script.google.com/macros/s/<id>/exec from Deploy → Web app. Redeploy after changing webapp.access. '
        : ' ';
      throw new Error(
        'Response was not JSON (HTTP ' +
          statusCode +
          ').' +
          hint +
          'Body starts: ' +
          bodyText.replace(/\s+/g, ' ').slice(0, 280)
      );
    }
    return {
      httpCode: statusCode,
      json: parsedBody,
      raw: bodyText,
    };
  }

  return {
    fetchNamedTokens,
    fetchNamedTokensFromProperties,
    parseCommaNames,
  };
});
