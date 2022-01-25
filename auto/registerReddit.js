const cluster = require("cluster");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startRegister = async function (numProcesses) {
  cluster.setupMaster({
    exec: __dirname + "/registerWorker.js",
  });

  if (cluster.isMaster) {
    for (let i = 0; i < numProcesses; i++) {
      let worker = cluster.fork();
      await delay(5000);
    }
  }
  return;
};

exports.startRegister = startRegister;
