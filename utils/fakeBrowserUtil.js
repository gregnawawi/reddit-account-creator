const fs = require("fs");
const path = require("path");
const { randint } = require("./randomUtil");
const { FakeBrowser } = require("fakebrowser");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");

// Get random deviceDescriptor
function getRandomDeviceDescriptor(ddPath) {
  const files = fs.readdirSync(ddPath);
  return require(path.resolve(ddPath, files[randint(0, files.length - 1)]));
}

async function getFakeBrowser(options) {
  const {
    deviceDescriptorPath,
    headless = false,
    displayUserActionLayer = false,
    executablePath,
    userDataDir,
    captchaAPI,
    proxy,
    exportIP,
  } = options;
  return new Promise(async (resolve, reject) => {
    try {
      // Create browser instance
      const deviceDescriptor = getRandomDeviceDescriptor(deviceDescriptorPath);
      const builder = new FakeBrowser.Builder()
        .deviceDescriptor(deviceDescriptor)
        .displayUserActionLayer(displayUserActionLayer)
        .vanillaLaunchOptions({
          headless,
          executablePath,
          userDataDir,
        })
        .usePlugins([
          RecaptchaPlugin({
            provider: {
              id: "2captcha",
              token: captchaAPI,
            },
            visualFeedback: true,
          }),
        ])
        .proxy({
          proxy: `http://${proxy}`,
          exportIP,
        })
        .userDataDir(userDataDir);

      const fakeBrowser = await builder.launch();

      // Turn off notification
      const browserContext = fakeBrowser.vanillaBrowser.defaultBrowserContext();
      browserContext.overridePermissions("https://www.reddit.com", [
        "geolocation",
        "notifications",
      ]);

      resolve(fakeBrowser);
    } catch (err) {
      reject(`Can't get fakeBrowser, ${err}`);
    }
  });
}

module.exports = {
  getRandomDeviceDescriptor,
  getFakeBrowser,
};
