function createFakeUrlFetchApp(handler) {
  return {
    fetch: function (url, options) {
      return handler(String(url), options || {});
    },
  };
}

function createStaticJsonResponse(payload, httpCode) {
  const code = typeof httpCode === 'number' ? httpCode : 200;
  return {
    getResponseCode: function () {
      return code;
    },
    getContentText: function () {
      return JSON.stringify(payload);
    },
  };
}

function createSequenceUrlFetchApp(builders) {
  let index = 0;
  return {
    fetch: function (url, options) {
      const builder = builders[index];
      index += 1;
      if (!builder) {
        throw new Error('UrlFetch sequence exhausted');
      }
      return builder(url, options);
    },
  };
}

/**
 * Records every fetch({ url, method, headers, payload }) for assertions.
 * `responseFn(url, options)` returns a UrlFetch-like response object.
 */
function createRecordingUrlFetchApp(responseFn) {
  const calls = [];
  const app = {
    fetch: function (url, options) {
      const opt = options || {};
      calls.push({
        url: String(url),
        method: opt.method,
        headers: opt.headers ? { ...opt.headers } : {},
        payload: opt.payload,
      });
      return responseFn(url, options);
    },
  };
  return {
    UrlFetchApp: app,
    getCalls: function () {
      return calls.slice();
    },
    clearCalls: function () {
      calls.length = 0;
    },
  };
}

module.exports = {
  createFakeUrlFetchApp,
  createStaticJsonResponse,
  createSequenceUrlFetchApp,
  createRecordingUrlFetchApp,
};
