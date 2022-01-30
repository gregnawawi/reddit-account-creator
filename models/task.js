const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: Date,
  numProcesses: {
    type: Number,
    min: 0,
  },
  running: {
    type: Boolean,
    default: true,
  },
  registered: {
    type: Number,
    min: 0,
    default: 0,
  },
  failed: {
    type: Number,
    min: 0,
    default: 0,
  },
  note: String,
});

// Update to the latest document
taskSchema.methods.update = async function () {
  const latestTask = await this.model("Task").findOne({ _id: this._id });

  for (const key of Object.keys(this)) {
    this[key] = latestTask[key];
  }
};

taskSchema.methods.succeed = async function () {
  this.registered += 1;
  await this.save();
};

taskSchema.methods.fail = async function () {
  this.failed += 1;
  await this.save();
};

const Task = mongoose.model("Task", taskSchema);

exports.taskSchema = taskSchema;
exports.Task = Task;
