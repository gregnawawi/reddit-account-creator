const express = require("express");
const router = express.Router();
const { Process } = require("../models/process");
const { xProxy } = require("../models/xproxy");

// GET ALL PROCESSES
router.get("/", async (req, res) => {
  const processes = await Process.find().sort("workerId");
  res.send(processes);
});

// KILL ALL PROCESSES IMMEDIATELY
router.get("/kill-all", async (req, res) => {
  const processes = await Process.find().sort("workerId");
  try {
    for (p of processes) {
      process.kill(p.pid);
    }
  } catch (err) {}

  await Process.deleteMany();

  await xProxy.updateMany({}, { $set: { using: 0, rotating: false } });

  res.redirect("/");
});

exports.processRouter = router;
