// Reusable client: copy this file into any script project. See AGENTS.md.
;(function (root, factory) {
  root.TOKEN_CLIENT = factory();
})(this, function () {
  const PROP_AUTHENTICATOR_URL = 'AUTHENTICATOR_URL';
  const PROP_TOKEN_BROKER_URL = 'TOKEN_BROKER_URL';
  const PROP_DEMO_TOKEN_NAMES = 'DEMO_TOKEN_NAMES';
  const PROP_CALLER_SECRET = 'CALLER_SECRET';
  const PROP_AUTHENTICATOR_SCRIPT_ID = 'AUTHENTICATOR_SCRIPT_ID';
  const PROP_TOKEN_BROKER_SCRIPT_ID = 'TOKEN_BROKER_SCRIPT_ID';
  const DEFAULT_DEMO_NAMES = 'DEMO';
  const EXEC_API_BASE = 'https://script.googleapis.com/v1/scripts/';

  function fetchNamedTokens(names) {
    const props = PropertiesService.getScriptProperties();
    const authUrl = props.getProperty(PROP_AUTHENTICATOR_URL);
    const brokerUrl = props.getProperty(PROP_TOKEN_BROKER_URL);
    if (!authUrl || !brokerUrl) {
      throw new Error(
        'Set AUTHENTICATOR_URL and TOKEN_BROKER_URL in Script Properties'
      );
    }
    const callerSecret = props.getProperty(PROP_CALLER_SECRET) || '';
    const issueHeaders = callerSecret ? { 'X-Caller-Secret': callerSecret } : {};
    const issue = postJson(authUrl, { action: 'issue' }, issueHeaders);
    if (!issue.json.code) {
      throw new Error('Issue failed: ' + issue.raw);
    }
    const token = postJson(brokerUrl, {
      action: 'getToken',
      code: issue.json.code,
      names: names,
    });
    return {
      httpIssue: issue.httpCode,
      httpBroker: token.httpCode,
      issued: { expiresInSeconds: issue.json.expiresInSeconds },
      broker: token.json,
    };
  }
  function fetchNamedTokensFromProperties() {
    const props = PropertiesService.getScriptProperties();
    const raw =
      props.getProperty(PROP_DEMO_TOKEN_NAMES) || DEFAULT_DEMO_NAMES;
    return fetchNamedTokens(parseCommaNames(raw));
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

  /**
   * Domain-restricted path — uses API Executable deployments.
   * Requires AUTHENTICATOR_SCRIPT_ID + TOKEN_BROKER_SCRIPT_ID in Script Properties.
   * Consumer must run under a cairoconfessions.com account (enforced by executionApi.access: DOMAIN).
   */
  function fetchNamedTokensExec(names) {
    const props = PropertiesService.getScriptProperties();
    const authId = props.getProperty(PROP_AUTHENTICATOR_SCRIPT_ID);
    const brokerId = props.getProperty(PROP_TOKEN_BROKER_SCRIPT_ID);
    if (!authId || !brokerId) {
      throw new Error(
        'Set AUTHENTICATOR_SCRIPT_ID and TOKEN_BROKER_SCRIPT_ID in Script Properties'
      );
    }
    const token = ScriptApp.getOAuthToken();
    const issue = callScriptApi(authId, 'issueCode', [], token);
    if (!issue.code) {
      throw new Error('issueCode returned no code: ' + JSON.stringify(issue));
    }
    const result = callScriptApi(brokerId, 'getNamedTokens', [issue.code, names], token);
    return {
      issued: { expiresInSeconds: issue.expiresInSeconds },
      broker: result,
    };
  }
  function callScriptApi(scriptId, functionName, parameters, oauthToken) {
    const url = EXEC_API_BASE + scriptId + ':run';
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + oauthToken },
      contentType: 'application/json',
      payload: JSON.stringify({ function: functionName, parameters: parameters, devMode: false }),
      muteHttpExceptions: true,
    });
    const text = res.getContentText() || '{}';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Exec API response not JSON: ' + text);
    }
    if (parsed.error) {
      const details = parsed.error.details;
      const msg =
        (details && details[0] && details[0].errorMessage) ||
        JSON.stringify(parsed.error);
      throw new Error('Script API error: ' + msg);
    }
    return parsed.response ? parsed.response.result : {};
  }

  function postJson(url, payload, extraHeaders) {
    const headers = extraHeaders || {};
    const res = UrlFetchApp.fetch(String(url).trim(), {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify(payload),
      headers: headers,
    });
    const text = res.getContentText() || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error('Response was not JSON: ' + text);
    }
    return {
      httpCode: res.getResponseCode(),
      json: parsed,
      raw: text,
    };
  }

  return {
    fetchNamedTokens,
    fetchNamedTokensFromProperties,
    fetchNamedTokensExec,
    parseCommaNames,
  };
});
