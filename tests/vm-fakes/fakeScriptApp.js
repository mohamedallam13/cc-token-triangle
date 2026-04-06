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
  };
}

module.exports = {
  createFakeScriptApp,
};
