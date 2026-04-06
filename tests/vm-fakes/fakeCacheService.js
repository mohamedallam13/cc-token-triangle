function createFakeScriptCache() {
  const store = new Map();
  return {
    put: function (key, value, ttl) {
      store.set(String(key), String(value));
    },
    get: function (key) {
      if (!store.has(String(key))) {
        return null;
      }
      return store.get(String(key));
    },
    remove: function (key) {
      store.delete(String(key));
    },
  };
}

function createFakeCacheService() {
  const scriptCache = createFakeScriptCache();
  return {
    getScriptCache: function () {
      return scriptCache;
    },
  };
}

module.exports = {
  createFakeCacheService,
};
