function readTextOutput(output) {
  const raw = output._text || output.getContent && output.getContent();
  return JSON.parse(String(raw));
}

module.exports = {
  readTextOutput,
};
