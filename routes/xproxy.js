const express = require("express");
const router = express.Router();
const { xProxy } = require("../models/xproxy");

// XPROXY HOME PAGE
router.get("/", async (req, res) => {
  const proxies = await xProxy.find();
  res.render("proxy", { proxies: proxies });
});

// ADD NEW XPROXY
router.post("/", async (req, res) => {
  const proxies = req.body.proxies.split("\r\n");

  for (proxy of proxies) {
    const newProxy = new xProxy({
      proxy: proxy,
    });
    await newProxy.save();
  }

  res.redirect("/xproxies");
});

// DELETE ALL PROXIES
router.get("/delete-all", async (req, res) => {
  await xProxy.deleteMany();
  res.redirect("/xproxies");
});

exports.xProxyRouter = router;
