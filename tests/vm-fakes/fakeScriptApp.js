function createFakeScriptApp() {
  return {
    AuthMode: { FULL: 'FULL' },
    getScriptId: function () {
      return 'vm-test-script-id';
    },
    getAuthorizationInfo: function () {
      return {
        getAuthorizationStatus: function () {
          return 'AUTHORIZED';
        },
      };
    },
    getOAuthToken: function () {
      return 'fake-oauth-token';
    },
    isFake: true,
  };
}

module.exports = {
  createFakeScriptApp,
};
