const mongoose = require("mongoose");
const { Account } = require("../models/account");
const { Check } = require("../models/check");
const config = require("config");
const cluster = require("cluster");

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

async function run() {
  const accounts = await Account.find();
  const neededToCheckAccounts = [];
  const numProcesses = config.get("banCheckNumProcesses");
  for (let i = 0; i < accounts.length; i++) {
    if (i % numProcesses == cluster.worker.id - 1) {
      neededToCheckAccounts.push(accounts[i]);
    }
  }

  // Get latest new Check
  const newCheck = await Check.findOne({ running: true });
  newCheck.pid.push(process.pid);

  for (const account of neededToCheckAccounts) {
    await account.checkStatus();
    await Check.findOneAndUpdate(
      { _id: newCheck._id },
      { $inc: { checked: 1 } }
    );
  }

  await newCheck.update();
  if (newCheck.total == newCheck.checked) {
    newCheck.running = false;
    await newCheck.save();
  }

  process.exit();
}

run();
