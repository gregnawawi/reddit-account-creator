const express = require("express");
const router = express.Router();
const { Task } = require("../models/task");
const { startRegister } = require("../auto/registerReddit");

router.get("/all-tasks", async (req, res) => {
  const tasks = await Task.find().sort("-startDate");
  res.send(tasks);
});
// TASKS HOME PAGE
router.get("/", async (req, res) => {
  let numProcesses;
  if (req.query.numProcesses) {
    numProcesses = Number(req.query.numProcesses);
  } else {
    numProcesses = 1;
  }

  const runningTasks = await Task.find({ running: true });
  const running = runningTasks.length > 0;
  res.render("task", {
    running: running,
    processes: numProcesses,
  });
});

// STOP RUNNING TASK
router.get("/stop", async (req, res) => {
  await Task.findOneAndUpdate({ running: true }, { running: false });
  res.redirect("/");
});

// START NEW TASK
router.post("/start", async (req, res) => {
  const newTask = new Task({
    numProcesses: Number(req.body.numProcesses),
    note: req.body.note,
  });
  await newTask.save();
  startRegister(newTask.numProcesses);
  res.redirect(`/?numProcesses=${newTask.numProcesses}`);
});

exports.taskRouter = router;
