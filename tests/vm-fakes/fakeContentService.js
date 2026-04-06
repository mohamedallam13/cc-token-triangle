function createFakeContentService() {
  return {
    MimeType: {
      JSON: 'application/json',
    },
    createTextOutput: function (text) {
      const out = {
        _text: text,
        setMimeType: function (mime) {
          this._mime = mime;
          return this;
        },
      };
      return out;
    },
  };
}

module.exports = {
  createFakeContentService,
};
