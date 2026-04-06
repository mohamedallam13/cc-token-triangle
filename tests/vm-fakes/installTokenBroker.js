const { createFakePropertiesService } = require('./fakePropertiesService');
const { createFakeContentService } = require('./fakeContentService');
const { createFakeUrlFetchApp } = require('./fakeUrlFetchApp');
const { createFakeScriptApp } = require('./fakeScriptApp');

function installTokenBrokerGasFakes(sandbox, propertyMap, urlFetchHandler) {
  const props = propertyMap || {};
  sandbox.PropertiesService = createFakePropertiesService(props);
  sandbox.ContentService = createFakeContentService();
  sandbox.ScriptApp = createFakeScriptApp();
  sandbox.UrlFetchApp = createFakeUrlFetchApp(
    urlFetchHandler ||
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
  sandbox.console = console;
}

module.exports = {
  installTokenBrokerGasFakes,
};
