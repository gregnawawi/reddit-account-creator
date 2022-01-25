const cluster = require("cluster");
const { Check } = require("../models/check");
const { Account } = require("../models/account");
const mongoose = require("mongoose");
const config = require("config");

mongoose
  .connect(config.get("mongoDBHost"))
  .then(() =>
    console.log(`Connected to MongoDB host: ${config.get("mongoDBHost")}`)
  )
  .catch(() =>
    console.error(
      `FATAL ERROR: Can't connect to MongoDB host: ${config.get("mongoDBHost")}`
    )
  );

const startBanCheck = async function () {
  cluster.setupMaster({
    exec: __dirname + "/banCheckWorker.js",
  });

  if (cluster.isMaster) {
    // Create new Check
    const accounts = await Account.find();
    const newCheck = new Check({
      total: accounts.length,
    });
    await newCheck.save();
    for (let i = 0; i < config.get("banCheckNumProcesses"); i++) {
      cluster.fork();
    }
  }
  return;
};

exports.startBanCheck = startBanCheck;
