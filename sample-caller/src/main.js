function getPermission() {
  const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  return {
    ok: true,
    action: 'getPermission',
    service: 'cc-token-triangle-sample-caller',
    scriptId: ScriptApp.getScriptId(),
    authStatus: String(info.getAuthorizationStatus()),
    oauthScopes: [
      'https://www.googleapis.com/auth/script.scriptapp',
      'https://www.googleapis.com/auth/script.external_request',
    ],
  };
}

function runSample() {
  const SAMPLE_WANTED_TOKENS = ['DEMO'];
  return TOKEN_CLIENT.fetchNamedTokens(SAMPLE_WANTED_TOKENS);
}
