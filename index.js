const express = require("express");
const mongoose = require("mongoose");
const config = require("config");
const { taskRouter } = require("./routes/task");
const { processRouter } = require("./routes/process");
const { accountRouter } = require("./routes/account");
const { xProxyRouter } = require("./routes/xproxy");
const { checkRouter } = require("./routes/check");
const { emailRouter } = require("./routes/email");
const { settingsRouter } = require("./routes/settings");

mongoose
  .connect(config.get("mongoDBHost"))
  .then(() =>
    console.log(`Connected to MongoDB host: ${config.get("mongoDBHost")}`)
  )
  .catch(() =>
    console.error(
      `FATAL ERROR: can't connect to MongoDB host: ${config.get("mongoDBHost")}`
    )
  );

const app = express();
app.use("/assets", express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.use("/", taskRouter);
app.use("/processes", processRouter);
app.use("/accounts", accountRouter);
app.use("/xproxies", xProxyRouter);
app.use("/check", checkRouter);
app.use("/emails", emailRouter);
app.use("/settings", settingsRouter);

app.listen(3000);
