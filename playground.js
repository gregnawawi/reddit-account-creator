const config = require("config");
const { getFakeBrowser } = require("./utils/fakeBrowserUtil");
const path = require("path");

async function main() {
  const fakeBrowser = await getFakeBrowser({
    deviceDescriptorPath: config.get("deviceDescriptorPath"),
    executablePath: config.get("executableChromePath"),
    userDataDir: path.resolve(config.get("chromeProfilesPath"), `./testblabla`),
    captchaAPI: config.get("2captchaAPI"),
    proxy: "192.168.1.14:4001",
    exportIP: "192.168.1.14",
  });

  // Create a new tab
  const page = await fakeBrowser.vanillaBrowser.newPage();
  // Set default timeout for all
  page.setDefaultTimeout(config.get("defaultTimeout"));

  await page.goto("https://abrahamjuliot.github.io/creepjs/");
}

main();
