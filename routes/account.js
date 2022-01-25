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

// ACCOUNTS HOME PAGE
router.get("/", async (req, res) => {
  let currentPage;
  if (req.query.page) {
    currentPage = Number(req.query.page);
  } else {
    currentPage = 1;
  }
  const totalItems = await Account.countDocuments();
  const pageSize = 15;
  const totalPages = Math.ceil(totalItems / pageSize);

  const accounts = await Account.find()
    .sort("-createdDate")
    .limit(pageSize)
    .skip(pageSize * (currentPage - 1));

  res.render("account", {
    accounts: accounts,
    totalItems: totalItems,
    totalPages: totalPages,
    currentPage: currentPage,
  });
});

// EXPORT TO ZIP FILE
router.post("/export", async (req, res) => {
  const fromDate = new Date(req.body.fromDate);
  const toDate = new Date(req.body.toDate);
  const zip = new AdmZip();

  const accounts = await Account.find({
    createdDate: {
      $lte: endOfDay(toDate),
      $gte: startOfDay(fromDate),
    },
  }).select(
    "username password email passmail cookies verification IP createdDate status -_id"
  );

  const fields = [
    "username",
    "password",
    "email",
    "passmail",
    "cookies",
    "verification",
    "IP",
    "createdDate",
    "status",
  ];

  // Add CSV File
  const parser = new Parser({ fields });
  const accountsCSV = parser.parse(accounts);
  zip.addFile("accounts.csv", accountsCSV);

  // Add chrome profile folders
  for (const account of accounts) {
    const currentProfilePath = path.resolve(
      config.get("chromeProfilesPath"),
      `./${account.username}`
    );
    if (fs.existsSync(currentProfilePath)) {
      zip.addLocalFolder(currentProfilePath, account.username);
    }
  }

  const data = zip.toBuffer();

  const downloadName = `accounts_${formatDate(new Date(), "mm-dd-YYYY")}.zip`;

  res.set("Content-Type", "application/octet-stream");
  res.set("Content-Disposition", `attachment; filename=${downloadName}`);
  res.set("Content-Length", data.length);
  res.send(data);
});

exports.accountRouter = router;
