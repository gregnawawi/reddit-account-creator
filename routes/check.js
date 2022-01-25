const express = require("express");
const router = express.Router();
const { Check } = require("../models/check");
const { startBanCheck } = require("../auto/banCheck");

// START CHECKING
router.get("/start", async (req, res) => {
  startBanCheck();
  res.redirect("/accounts");
});

// GET STATUS
router.get("/status", async (req, res) => {
  const latestCheck = await Check.findOne().sort("-lastChecked");
  res.send(latestCheck);
});

// STOP IMMEDIATELY
router.get("/stop", async (req, res) => {
  const currentCheck = await Check.findOneAndUpdate(
    { running: true },
    { $set: { running: false } }
  );
  try {
    for (const pid of currentCheck.pid) {
      process.kill(pid);
    }
  } catch (err) {}

  res.redirect("/accounts");
});

exports.checkRouter = router;
