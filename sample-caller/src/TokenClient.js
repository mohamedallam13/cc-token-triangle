// Reusable client: copy this file into any script project. See AGENTS.md.
;(function (root, factory) {
  root.TOKEN_CLIENT = factory();
})(this, function () {
  const PROP_AUTHENTICATOR_URL = 'AUTHENTICATOR_URL';
  const PROP_TOKEN_BROKER_URL = 'TOKEN_BROKER_URL';
  const PROP_DEMO_TOKEN_NAMES = 'DEMO_TOKEN_NAMES';
  const PROP_CALLER_SECRET = 'CALLER_SECRET';
  const DEFAULT_DEMO_NAMES = 'DEMO';

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
    parseCommaNames,
  };
});
