const { createFakePropertiesService } = require('./fakePropertiesService');
const { createFakeContentService } = require('./fakeContentService');
const { createFakeUrlFetchApp } = require('./fakeUrlFetchApp');
const { createFakeScriptApp } = require('./fakeScriptApp');

function installTokenBrokerGasFakes(sandbox, propertyMap, urlFetchHandlerOrApp) {
  const props = propertyMap || {};
  sandbox.PropertiesService = createFakePropertiesService(props);
  sandbox.ContentService = createFakeContentService();
  sandbox.ScriptApp = createFakeScriptApp();
  if (
    urlFetchHandlerOrApp &&
    typeof urlFetchHandlerOrApp.fetch === 'function'
  ) {
    sandbox.UrlFetchApp = urlFetchHandlerOrApp;
  } else {
    sandbox.UrlFetchApp = createFakeUrlFetchApp(
      urlFetchHandlerOrApp ||
        function () {
          return {
            getResponseCode: function () {
              return 200;
            },
            getContentText: function () {
              return JSON.stringify({ valid: true });
            },
          };
        }
    );
  }
  sandbox.console = console;
}

module.exports = {
  installTokenBrokerGasFakes,
};
