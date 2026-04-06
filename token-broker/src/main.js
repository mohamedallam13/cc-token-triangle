function doGet(e) {
  return BROKER_APP.handleGet(e);
}

function doPost(event) {
  return BROKER_APP.handlePost(event);
}

/** API Executable entry — domain-restricted (executionApi.access: DOMAIN). */
function getNamedTokens(code, names) {
  return BROKER_APP.handleExecGetTokens(code, names);
}
