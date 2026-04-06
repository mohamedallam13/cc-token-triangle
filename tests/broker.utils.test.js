const path = require('path');

describe('BROKER_UTILS (pure)', () => {
  let BROKER_UTILS;
  let BROKER_ENV;
  beforeEach(() => {
    jest.resetModules();
    const envPath = path.join(__dirname, '../token-broker/src/ENV.js');
    const utilsPath = path.join(__dirname, '../token-broker/src/Utils.js');
    BROKER_ENV = require(envPath).BROKER_ENV;
    BROKER_UTILS = require(utilsPath).BROKER_UTILS;
  });

  test('tokenPropertyKey normalizes names', () => {
    expect(BROKER_UTILS.tokenPropertyKey(' my-api ', BROKER_ENV.TOKEN_PREFIX)).toBe(
      'TOKEN_MY_API'
    );
  });
});
