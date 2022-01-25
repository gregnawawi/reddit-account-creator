const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

router.get("/", async (req, res) => {
  // Read settings from JSON file
  const rawData = fs.readFileSync(
    path.resolve(__dirname, "../config/default.json")
  );
  const settings = JSON.parse(rawData);

  // Pre-processing convert ms -> s
  settings.delayPerAttemp /= 1000;
  settings.defaultTimeout /= 1000;
  settings.delayPerAction /= 1000;
  res.render("settings", { settings: settings });
});

router.post("/", async (req, res) => {
  // Read settings from JSON file
  const rawData = fs.readFileSync(
    path.resolve(__dirname, "../config/default.json")
  );
  const settings = JSON.parse(rawData);

  // Pre-processing req.body
  if (!req.body.verifyEmail) {
    req.body.verifyEmail = false;
  } else {
    req.body.verifyEmail = true;
  }
  if (!req.body.turnOnNSFW) {
    req.body.turnOnNSFW = false;
  } else {
    req.body.turnOnNSFW = true;
  }
  if (!req.body.headless) {
    req.body.headless = false;
  } else {
    req.body.headless = true;
  }

  // Pre-processing s -> ms
  req.body.delayPerAttemp *= 1000;
  req.body.defaultTimeout *= 1000;
  req.body.delayPerAction *= 1000;

  // Convert to number
  req.body.maxAttemps = Number(req.body.maxAttemps);
  req.body.typingDelay = Number(req.body.typingDelay);
  req.body.banCheckNumProcesses = Number(req.body.banCheckNumProcesses);

  // Override to previous settings
  // Using spread operators to prevent missing elements from defaul.json
  const updatedSettings = { ...settings, ...req.body };

  fs.writeFile(
    path.resolve(__dirname, "../config/default.json"),
    JSON.stringify(updatedSettings),
    (err) => {
      if (err) console.error(err);
    }
  );
  res.redirect("/settings");
});

exports.settingsRouter = router;
