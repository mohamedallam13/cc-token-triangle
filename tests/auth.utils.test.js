const path = require('path');

describe('AUTH_UTILS (pure)', () => {
  let AUTH_UTILS;
  beforeEach(() => {
    jest.resetModules();
    AUTH_UTILS = require(path.join(__dirname, '../authenticator/src/Utils.js')).AUTH_UTILS;
  });

  test('secretHeaderOutcome accepts matching secret', () => {
    expect(AUTH_UTILS.secretHeaderOutcome('abc', 'abc').ok).toBe(true);
  });

  test('secretHeaderOutcome rejects mismatch', () => {
    const result = AUTH_UTILS.secretHeaderOutcome('expected', 'wrong');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('extractInternalSecret reads X-Internal-Secret', () => {
    const secret = AUTH_UTILS.extractInternalSecret({
      'X-Internal-Secret': 'mysecret',
    });
    expect(secret).toBe('mysecret');
  });

  test('extractInternalSecret reads Bearer', () => {
    const secret = AUTH_UTILS.extractInternalSecret({
      Authorization: 'Bearer tokenvalue',
    });
    expect(secret).toBe('tokenvalue');
  });
});
