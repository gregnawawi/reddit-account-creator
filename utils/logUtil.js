const fs = require("fs");

class Logger {
  constructor(logPath) {
    this.logPath = logPath;
  }

  error(msg) {
    const now = new Date();
    const output = `[${now.toLocaleString()}] [ERROR] ${msg}\n`;
    fs.appendFile(this.logPath, output, (err) => {
      if (err) throw err;
    });
  }
}

module.exports = {
  Logger,
};
