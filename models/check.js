const mongoose = require("mongoose");

const checkSchema = new mongoose.Schema({
  lastChecked: {
    type: Date,
    default: Date.now,
  },
  running: {
    type: Boolean,
    default: true,
  },
  checked: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    default: 0,
  },
  pid: {
    type: [Number],
    default: [],
  },
});

// Update to the latest document
checkSchema.methods.update = async function () {
  const latestCheck = await this.model("Check").findOne({ _id: this._id });

  for (const key of Object.keys(this)) {
    this[key] = latestCheck[key];
  }
};

const Check = mongoose.model("Check", checkSchema);

exports.checkSchema = checkSchema;
exports.Check = Check;
