const mongoose = require("mongoose");
const { request } = require("undici");

const accountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    maxlength: 255,
  },
  password: {
    type: String,
    required: true,
    maxlength: 255,
  },
  email: {
    type: String,
    required: false,
    maxlength: 255,
  },
  passmail: {
    type: String,
    required: false,
    maxlength: 255,
  },
  cookies: String,
  verification: String,
  status: {
    type: Boolean,
    default: true,
  },
  IP: String,
  createdDate: {
    type: Date,
    default: Date.now,
  },
  profileId: String,
  note: String,
});

accountSchema.methods.checkStatus = async function () {
  try {
    const { body } = await request(
      `https://old.reddit.com/user/${this.username}`
    );
    body.setEncoding("utf8");
    let content = "";
    for await (const data of body) {
      content += data;
    }
    if (content.includes("page not found")) {
      this.status = false;
    } else {
      this.status = true;
    }
    await this.save();
  } catch (err) {}
};

const Account = mongoose.model("Account", accountSchema);

exports.accountSchema = accountSchema;
exports.Account = Account;
