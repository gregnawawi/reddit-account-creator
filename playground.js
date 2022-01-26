const config = require("config");
const { getFakeBrowser } = require("./utils/fakeBrowserUtil");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { Task } = require("./models/task");

async function foo() {
  return new Promise((resolve, reject) => {
    throw new Error();
    console.log("I'm in foo");
  });
}

// Connect to MongoDB
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

async function main() {
  try {
    const test = await foo();
    console.log(test);
  } catch (err) {
    console.error(err);
  }
}

main();
