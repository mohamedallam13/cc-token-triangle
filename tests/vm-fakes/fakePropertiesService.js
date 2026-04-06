function createFakePropertiesService(initial) {
  const data = Object.assign({}, initial);
  const scriptProps = {
    getProperty: function (key) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        return null;
      }
      return data[key];
    },
    setProperty: function (key, value) {
      data[key] = value;
    },
    deleteProperty: function (key) {
      delete data[key];
    },
    snapshot: function () {
      return Object.assign({}, data);
    },
  };
  return {
    getScriptProperties: function () {
      return scriptProps;
    },
  };
}

module.exports = {
  createFakePropertiesService,
};
