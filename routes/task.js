const express = require("express");
const router = express.Router();
const { Task } = require("../models/task");
const { startRegister } = require("../auto/registerReddit");

// TASKS HOME PAGE
router.get("/", async (req, res) => {
  let currentPage;
  if (req.query.page) {
    currentPage = Number(req.query.page);
  } else {
    currentPage = 1;
  }

  let numProcesses;
  if (req.query.numProcesses) {
    numProcesses = Number(req.query.numProcesses);
  } else {
    numProcesses = 1;
  }

  const totalItems = await Task.countDocuments();
  const pageSize = 10;
  const totalPages = Math.ceil(totalItems / pageSize);

  const recentTasks = await Task.find()
    .sort("-startDate")
    .limit(pageSize)
    .skip(pageSize * (currentPage - 1));
  const runningTasks = await Task.find({ running: true });
  const running = runningTasks.length > 0;
  res.render("task", {
    recentTasks: recentTasks,
    running: running,
    currentPage: currentPage,
    totalItems: totalItems,
    totalPages: totalPages,
    processes: numProcesses,
  });
});

// STOP RUNNING TASK
router.get("/stop", async (req, res) => {
  await Task.findOneAndUpdate({ running: true }, { running: false });
  res.redirect("/");
});

// START NEW TASK
router.get("/start", async (req, res) => {
  const newTask = new Task({
    numProcesses: Number(req.query.numProcesses),
  });
  await newTask.save();
  startRegister(newTask.numProcesses);
  res.redirect(`/?numProcesses=${newTask.numProcesses}`);
});

exports.taskRouter = router;
