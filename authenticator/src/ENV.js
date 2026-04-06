;(function (root, factory) {
  root.AUTH_ENV = factory();
})(this, function () {
  const SERVICE_ID = 'cc-token-triangle-authenticator';
  /** Declared OAuth scopes (mirror manifest when you add oauthScopes). */
  const OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/script.scriptapp',
  ];
  const CACHE_PREFIX = 'cct_auth_code:';
  const CODE_TTL_SECONDS = 60;
  const MAX_BODY_BYTES = 65536;
  const PROP_AUTH_INTERNAL_SECRET = 'AUTH_INTERNAL_SECRET';
  const PROP_CALLER_SECRET = 'CALLER_SECRET';
  /** Rate-limit on /issue: key prefix + max calls per 1-minute window. */
  const ISSUE_RATE_KEY = 'cct_issue_rate:';
  const ISSUE_RATE_MAX = 30;

  function getAuthInternalSecret() {
    const raw = PropertiesService.getScriptProperties().getProperty(
      PROP_AUTH_INTERNAL_SECRET
    );
    return raw ? String(raw) : '';
  }
  function getCallerSecret() {
    const raw = PropertiesService.getScriptProperties().getProperty(
      PROP_CALLER_SECRET
    );
    return raw ? String(raw) : '';
  }

  return {
    SERVICE_ID,
    OAUTH_SCOPES,
    CACHE_PREFIX,
    CODE_TTL_SECONDS,
    MAX_BODY_BYTES,
    PROP_AUTH_INTERNAL_SECRET,
    PROP_CALLER_SECRET,
    ISSUE_RATE_KEY,
    ISSUE_RATE_MAX,
    getAuthInternalSecret,
    getCallerSecret,
  };
});
