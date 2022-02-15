const express = require("express");
const router = express.Router();
const { Account } = require("../models/account");
const { Parser } = require("json2csv");
const { endOfDay, startOfDay } = require("date-fns");
const AdmZip = require("adm-zip");
const fs = require("fs");
const config = require("config");
const path = require("path");
const { formatDate } = require("../utils/dateUtil");

router.get("/all", async (req, res) => {
  const accounts = await Account.find().sort("-createdDate");
  res.send(accounts);
});

// ACCOUNTS HOME PAGE
router.get("/", async (req, res) => {
  res.render("account");
});

// EXPORT TO ZIP FILE
router.post("/export", async (req, res) => {
  const fromDate = new Date(req.body.fromDate);
  const toDate = new Date(req.body.toDate);
  const verification = req.body.verification;
  const status = req.body.status;
  const nsfw = req.body.nsfw;
  const queryOptions = {
    createdDate: {
      $lte: endOfDay(toDate),
      $gte: startOfDay(fromDate),
    },
  };
  switch (verification) {
    case "no": {
      queryOptions.mailVerified = false;
      break;
    }

    case "mailVerified": {
      queryOptions.mailVerified = true;
      break;
    }
  }

  switch (status) {
    case "live": {
      queryOptions.status = true;
      break;
    }

    case "died": {
      queryOptions.status = false;
      break;
    }
  }

  switch (nsfw) {
    case "on": {
      queryOptions.NSFW = true;
      break;
    }

    case "off": {
      queryOptions.NSFW = false;
      break;
    }
  }
  // const zip = new AdmZip();

  const accounts = await Account.find(queryOptions).select(
    "username password email passmail cookies NSFW mailVerified IP createdDate status -_id"
  );

  const fields = [
    "username",
    "password",
    "email",
    "passmail",
    "cookies",
    "NSFW",
    "mailVerified",
    "IP",
    "createdDate",
    "status",
  ];

  // Add CSV File
  const parser = new Parser({ fields });
  const accountsCSV = parser.parse(accounts);
  // zip.addFile("accounts.csv", accountsCSV);

  // Add chrome profile folders
  // for (const account of accounts) {
  //   const currentProfilePath = path.resolve(
  //     config.get("chromeProfilesPath"),
  //     `./${account.username}`
  //   );
  //   if (fs.existsSync(currentProfilePath)) {
  //     zip.addLocalFolder(currentProfilePath, account.username);
  //   }
  // }

  // const data = zip.toBuffer();

  const downloadName = `accounts_${formatDate(new Date(), "mm-dd-YYYY")}.csv`;

  res.set("Content-Type", "application/octet-stream");
  res.set("Content-Disposition", `attachment; filename=${downloadName}`);
  res.set("Content-Length", accountsCSV.length);
  res.send(accountsCSV);
});

exports.accountRouter = router;
