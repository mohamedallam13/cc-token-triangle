const fs = require('fs');
const path = require('path');
const vm = require('vm');

function runFilesInSandbox(sandbox, absolutePaths) {
  vm.createContext(sandbox);
  for (let i = 0; i < absolutePaths.length; i++) {
    const filePath = absolutePaths[i];
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(code, sandbox, { filename: filePath });
  }
}

function authenticatorChain(rootDir) {
  return [
    path.join(rootDir, 'ENV.js'),
    path.join(rootDir, 'Utils.js'),
    path.join(rootDir, 'AuthApp.js'),
    path.join(rootDir, 'main.js'),
  ];
}

function tokenBrokerChain(rootDir) {
  return [
    path.join(rootDir, 'ENV.js'),
    path.join(rootDir, 'Utils.js'),
    path.join(rootDir, 'BrokerApp.js'),
    path.join(rootDir, 'main.js'),
  ];
}

function sampleCallerChain(rootDir) {
  return [
    path.join(rootDir, 'TokenClient.js'),
    path.join(rootDir, 'main.js'),
  ];
}

module.exports = {
  runFilesInSandbox,
  authenticatorChain,
  tokenBrokerChain,
  sampleCallerChain,
};
