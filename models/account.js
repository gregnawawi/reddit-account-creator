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
  NSFW: Boolean,
  profileId: String,
  note: String,
  mailVerified: Boolean,
});

accountSchema.methods.checkStatus = async function () {
  try {
    const { body } = await request(
      `https://www.reddit.com/user/${this.username}/about.json`
    );
    body.setEncoding("utf8");
    let content = "";
    for await (const data of body) {
      content += data;
    }
    content = JSON.parse(content);
    if (content.error) {
      this.status = false;
    } else {
      content = content.data;
      this.NSFW = content.subreddit.over_18;
      this.createdDate = new Date(content.created * 1000);
      this.mailVerified = content.has_verified_email;
      // this.karma = content.total_karma;
    }
    await this.save();
  } catch (err) {}
};

const Account = mongoose.model("Account", accountSchema);

exports.accountSchema = accountSchema;
exports.Account = Account;
