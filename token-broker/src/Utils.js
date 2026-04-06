;(function (root, factory) {
  root.BROKER_UTILS = factory();
})(this, function () {
  function tokenPropertyKey(name, tokenPrefix) {
    const n = String(name || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
    if (!n) {
      return '';
    }
    return String(tokenPrefix) + n;
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

  return {
    tokenPropertyKey,
    parseJsonContents,
  };
});
