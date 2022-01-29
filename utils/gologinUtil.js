const puppeteer = require("puppeteer-extra");
const GoLogin = require("gologin");

// Create a new Gologin Browser
async function createNewGologinBrowser(options) {
  const { accessToken, profileName, captchaAPI, os = "win", proxy } = options;
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
      const goLogin = new GoLogin({ token: accessToken });

      const profileId = await goLogin.create({
        name: profileName,
        os,
        proxy,
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

      resolve({ goLoginBrowser, profileId });
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
    maxAttemps,
    delayPerAttemp,
    captchaAPI,
    logger = console,
    proxy,
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
    for (let i = 0; i < maxAttemps; i++) {
      try {
        const goLogin = new GoLogin({
          token: accessToken,
          profile_id: profileId,
        });
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

        resolve({ goLoginBrowser });
        return;
      } catch (err) {
        logger.error(`Can't re-use Gologin browser, ${err}`);
        await delay(delayPerAttemp);
      }
    }
    reject("Can't re-use Gologin browser, exceeded attemps");
  });
}

module.exports = {
  createNewGologinBrowser,
  reuseGologinBrowser,
};
