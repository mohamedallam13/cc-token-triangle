;(function (root, factory) {
  root.AUTH_UTILS = factory();
})(this, function () {
  function cacheKeyForCode(prefix, code) {
    return String(prefix) + String(code);
  }
  function normalizeChallengeCode(code) {
    if (!code || typeof code !== 'string') return '';
    return code.trim();
  }
  function secretHeaderOutcome(expected, provided) {
    if (!expected) {
      return { ok: false, error: 'AUTH_INTERNAL_SECRET is not set in Script Properties' };
    }
    if (!provided || provided !== expected) {
      return { ok: false, error: 'Invalid or missing internal secret' };
    }
    return { ok: true };
  }
  function parseJsonContents(contents, maxBytes) {
    const raw = contents || '';
    if (raw.length > maxBytes) {
      throw new Error('Request body too large');
    }
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error('Invalid JSON body');
    }
  }
  function extractInternalSecret(headers) {
    const headerMap = headers || {};
    const lower = {};
    Object.keys(headerMap).forEach(function (key) {
      lower[String(key).toLowerCase()] = headerMap[key];
    });
    const direct = lower['x-internal-secret'];
    if (direct) {
      return String(direct);
    }
    const auth = lower['authorization'];
    if (auth && /^Bearer\s+/i.test(String(auth))) {
      return String(auth).replace(/^Bearer\s+/i, '').trim();
    }
    return '';
  }
  /** Web app /exec often omits custom headers on event.headers — verify route uses this + body.internalSecret */
  function extractInternalSecretHeaderOnly(headers) {
    const headerMap = headers || {};
    const lower = {};
    Object.keys(headerMap).forEach(function (key) {
      lower[String(key).toLowerCase()] = headerMap[key];
    });
    const direct = lower['x-internal-secret'];
    return direct ? String(direct) : '';
  }
  function extractCallerSecret(headers) {
    const headerMap = headers || {};
    const lower = {};
    Object.keys(headerMap).forEach(function (key) {
      lower[String(key).toLowerCase()] = headerMap[key];
    });
    const val = lower['x-caller-secret'];
    return val ? String(val) : '';
  }

  return {
    cacheKeyForCode,
    normalizeChallengeCode,
    secretHeaderOutcome,
    parseJsonContents,
    extractInternalSecret,
    extractInternalSecretHeaderOnly,
    extractCallerSecret,
  };
});
