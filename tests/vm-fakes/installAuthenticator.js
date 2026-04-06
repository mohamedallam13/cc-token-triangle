const { createFakeCacheService } = require('./fakeCacheService');
const { createFakePropertiesService } = require('./fakePropertiesService');
const { createFakeContentService } = require('./fakeContentService');
const { createFakeScriptApp } = require('./fakeScriptApp');

function installAuthenticatorGasFakes(sandbox, propertyMap) {
  if (!globalThis.Utilities || typeof globalThis.Utilities.getUuid !== 'function') {
    throw new Error(
      'globalThis.Utilities missing — run bootstrapGasFakes() before vm tests (see tests/jest.setup.js)'
    );
  }
  const props = propertyMap || {};
  sandbox.Utilities = globalThis.Utilities;
  sandbox.CacheService = createFakeCacheService();
  sandbox.PropertiesService = createFakePropertiesService(props);
  sandbox.ContentService = createFakeContentService();
  sandbox.ScriptApp = createFakeScriptApp();
  sandbox.console = console;
}

module.exports = {
  installAuthenticatorGasFakes,
};
