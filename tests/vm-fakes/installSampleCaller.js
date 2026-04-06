const { createFakePropertiesService } = require('./fakePropertiesService');
const { createFakeUrlFetchApp } = require('./fakeUrlFetchApp');
const { createFakeScriptApp } = require('./fakeScriptApp');

function installSampleCallerGasFakes(sandbox, propertyMap, urlFetchHandler) {
  if (!globalThis.Logger || typeof globalThis.Logger.log !== 'function') {
    throw new Error(
      'globalThis.Logger missing — run bootstrapGasFakes() before vm tests (see tests/jest.setup.js)'
    );
  }
  const props = propertyMap || {};
  sandbox.PropertiesService = createFakePropertiesService(props);
  sandbox.ScriptApp = createFakeScriptApp();
  sandbox.Logger = globalThis.Logger;
  if (urlFetchHandler && typeof urlFetchHandler.fetch === 'function') {
    sandbox.UrlFetchApp = urlFetchHandler;
  } else {
    sandbox.UrlFetchApp = createFakeUrlFetchApp(urlFetchHandler);
  }
  sandbox.console = console;
}

module.exports = {
  installSampleCallerGasFakes,
};
