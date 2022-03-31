const express = require("express");
const router = express.Router();
const { Tinsoft } = require("../models/tinsoft");

// TINSOFT HOME PAGE
router.get("/", async (req, res) => {
  const tinsofts = await Tinsoft.find();
  res.render("tinsoft", { tinsofts });
});

// ADD NEW TINSOFT
router.post("/", async (req, res) => {
  const tinsofts = req.body.tinsofts.split("\r\n");

  for (const tinsoft of tinsofts) {
    const newTinsoft = new Tinsoft({
      APIKey: tinsoft,
    });
    await newTinsoft.save();
  }

  res.redirect("/tinsofts");
});

// DELETE ALL TINSOFTS
router.get("/delete-all", async (req, res) => {
  await Tinsoft.deleteMany();
  res.redirect("/tinsofts");
});

exports.tinsoftRouter = router;
