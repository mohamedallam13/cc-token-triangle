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

module.exports = {
  createFakeUrlFetchApp,
  createStaticJsonResponse,
  createSequenceUrlFetchApp,
};
