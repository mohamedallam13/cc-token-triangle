function doGet(e) {
  return AUTH_APP.handleGet(e);
}

function doPost(event) {
  return AUTH_APP.handlePost(event);
}

/** API Executable entry — domain-restricted (executionApi.access: DOMAIN). */
function issueCode() {
  return AUTH_APP.handleExecIssue();
}
