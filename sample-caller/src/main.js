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

/**
 * Run menu sample: reads DEMO_TOKEN_NAMES from Script Properties (comma-separated),
 * then requests those named tokens via TOKEN_CLIENT (which reads auth/broker URLs + transports from props).
 */
function runSample() {
  Logger.log('[sample-caller] runSample — start');
  const scriptProperties = PropertiesService.getScriptProperties();
  const tokenNamesRaw = scriptProperties.getProperty('DEMO_TOKEN_NAMES');
  Logger.log(
    '[sample-caller] DEMO_TOKEN_NAMES from props: ' +
      (tokenNamesRaw == null || String(tokenNamesRaw).trim() === ''
        ? '(empty → default DEMO)'
        : String(tokenNamesRaw))
  );
  const tokenNamesList = TOKEN_CLIENT.parseCommaNames(
    tokenNamesRaw == null || String(tokenNamesRaw).trim() === ''
      ? 'DEMO'
      : tokenNamesRaw
  );
  const result = TOKEN_CLIENT.fetchNamedTokens(tokenNamesList, { verbose: true });
  Logger.log('[sample-caller] runSample — return value: ' + JSON.stringify(result));
  Logger.log('[sample-caller] runSample — end');
  return result;
}
