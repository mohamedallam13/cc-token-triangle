;(function (root, factory) {
  root.BROKER_ENV = factory();
})(this, function () {
  const SERVICE_ID = 'cc-token-triangle-broker';
  /** Declared OAuth scopes (mirror manifest when you add oauthScopes). */
  const OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/script.external_request',
  ];
  const MAX_BODY_BYTES = 65536;
  const TOKEN_PREFIX = 'TOKEN_';
  const PROP_AUTHENTICATOR_BASE_URL = 'AUTHENTICATOR_BASE_URL';
  const PROP_AUTH_INTERNAL_SECRET = 'AUTH_INTERNAL_SECRET';
  return {
    SERVICE_ID,
    OAUTH_SCOPES,
    MAX_BODY_BYTES,
    TOKEN_PREFIX,
    PROP_AUTHENTICATOR_BASE_URL,
    PROP_AUTH_INTERNAL_SECRET,
  };
});
