const express = require("express");
const { Email } = require("../models/email");
const router = express.Router();

// EMAILS HOME PAGE
router.get("/", async (req, res) => {
  let currentPage;
  if (req.query.page) {
    currentPage = Number(req.query.page);
  } else {
    currentPage = 1;
  }
  const totalItems = await Email.countDocuments();
  const pageSize = 15;
  const totalPages = Math.ceil(totalItems / pageSize);

  const emails = await Email.find()
    .sort("-addedDate")
    .limit(pageSize)
    .skip(pageSize * (currentPage - 1));

  res.render("email", {
    emails: emails,
    totalItems: totalItems,
    totalPages: totalPages,
    currentPage: currentPage,
  });
});

// ADD NEW EMAILS
router.post("/", async (req, res) => {
  const emails = req.body.emails.split("\r\n");

  for (email of emails) {
    const newEmail = new Email({
      username: email.split("|")[0],
      password: email.split("|")[1],
    });
    await newEmail.save();
  }

  res.redirect("/emails");
});

exports.emailRouter = router;
