function log(...args) {
    console.log(new Date().toISOString(), '-', ...args);
  }
  
  function logError(...args) {
    console.error(new Date().toISOString(), '- ERROR -', ...args);
  }
  
  module.exports = { log, logError };