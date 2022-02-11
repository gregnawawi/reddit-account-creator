const puppeteer = require("puppeteer-extra");
const GoLogin = require("gologin");

// Create a new Gologin Browser
async function createNewGologinBrowser(options) {
  const {
    accessToken,
    profileName,
    captchaAPI,
    os = "win",
    proxy,
    tmpdir,
    headless = false,
  } = options;
  const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
  puppeteer.use(
    RecaptchaPlugin({
      provider: {
        id: "2captcha",
        token: captchaAPI,
      },
      visualFeedback: true,
    })
  );
  return new Promise(async (resolve, reject) => {
    try {
      const gologinOptions = {
        token: accessToken,
        extra_params: [
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
        tmpdir,
      };
      if (headless) {
        gologinOptions.extra_params.push("--headless");
      }
      const goLogin = new GoLogin(gologinOptions);

      const profileId = await goLogin.create({
        name: profileName,
        os,
        proxy,
        canvas: {
          mode: "noise",
          noise: 0,
        },
      });
      await goLogin.update({
        id: profileId,
        name: profileName,
      });

      const { status, wsUrl } = await goLogin.start();

      if (status !== "success") {
        throw new Error(`Invalid status: ${status}`);
      }

      const goLoginBrowser = await puppeteer.connect({
        browserWSEndpoint: wsUrl.toString(),
        ignoreHTTPSErrors: true,
      });

      resolve({ goLoginBrowser, profileId, goLogin });
      return;
    } catch (err) {
      reject(`Can't create new Gologin browser, ${err}`);
    }
  });
}

// Re-use Gologin browser using profileId
async function reuseGologinBrowser(options) {
  const {
    accessToken,
    profileId,
    captchaAPI,
    proxy,
    tmpdir,
    headless = false,
  } = options;
  const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
  puppeteer.use(
    RecaptchaPlugin({
      provider: {
        id: "2captcha",
        token: captchaAPI,
      },
      visualFeedback: true,
    })
  );
  return new Promise(async (resolve, reject) => {
    try {
      const gologinOptions = {
        token: accessToken,
        profile_id: profileId,
        extra_params: [
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
        tmpdir,
      };
      if (headless) {
        gologinOptions.extra_params.push("--headless");
      }
      const goLogin = new GoLogin(gologinOptions);
      await goLogin.update({
        proxy,
        id: profileId,
      });

      const { status, wsUrl } = await goLogin.start();

      if (status !== "success") {
        throw new Error(`Invalid status: ${status}`);
      }

      const goLoginBrowser = await puppeteer.connect({
        browserWSEndpoint: wsUrl.toString(),
        ignoreHTTPSErrors: true,
      });

      resolve({ goLoginBrowser, goLogin });
      return;
    } catch (err) {
      reject(`Can't re-use Gologin browser, ${err}`);
    }
  });
}

module.exports = {
  createNewGologinBrowser,
  reuseGologinBrowser,
};
