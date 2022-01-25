const mongoose = require("mongoose");

const processSchema = new mongoose.Schema({
  workerId: Number,
  status: {
    type: String,
    default: "Waiting",
  },
  proxy: {
    type: String,
    default: "Waiting",
  },
  currentIP: {
    type: String,
    default: "Waiting",
  },
  pid: Number,
});

// Update to the latest document
processSchema.methods.update = async function () {
  const latestProcess = await this.model("Process").findOne({ _id: this._id });

  for (const key of Object.keys(this)) {
    this[key] = latestProcess[key];
  }
};

const Process = mongoose.model("Process", processSchema);

exports.processSchema = processSchema;
exports.Process = Process;
