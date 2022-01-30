const config = require("config");
const { Account } = require("./models/account");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
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
const getDirectories = (source) =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

async function main() {
  const accounts = await Account.find();
  const accountUsernames = [];
  for (const account of accounts) {
    accountUsernames.push(account.username);
  }
  const dirs = await getDirectories(config.get("chromeProfilesPath"));
  for (const dirName of dirs) {
    if (accountUsernames.indexOf(dirName) == -1) {
      fs.rmSync(
        path.resolve(config.get("chromeProfilesPath"), `./${dirName}`),
        { recursive: true, force: true }
      );
      console.log(dirName);
    }
  }
}

main();
