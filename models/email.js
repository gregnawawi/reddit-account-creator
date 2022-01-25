const mongoose = require("mongoose");

const emailSchema = new mongoose.Schema({
  username: String,
  password: String,
  addedDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: Boolean,
    default: true,
  },
});

const Email = mongoose.model("Email", emailSchema);

exports.emailSchema = emailSchema;
exports.Email = Email;
