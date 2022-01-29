const config = require("config");
const cluster = require("cluster");
const mongoose = require("mongoose");
const { Account } = require("../models/account");
const { Task } = require("../models/task");
const { xProxy } = require("../models/xproxy");
const { Process } = require("../models/process");
const { Email } = require("../models/email");
const path = require("path");
const { delay } = require("../utils/otherUtil");
const { txtToArray } = require("../utils/fileUtil");
const { loopUntilSuccess } = require("../utils/otherUtil");
const { scrollPage } = require("../utils/puppeteerUtil");
const {
  getEmailVerificationLink,
  checkUsernameAvailability,
} = require("../utils/redditUtil");
const { getFakeBrowser } = require("../utils/fakeBrowserUtil");
const {
  randomString,
  randomUsername,
  choice,
  randint,
} = require("../utils/randomUtil");
const { Logger } = require("../utils/logUtil");
const { createNewGologinBrowser } = require("../utils/gologinUtil");

// Connect to MongoDB
mongoose
  .connect(config.get("mongoDBHost"))
  .then(() =>
    console.log(`Connected to MongoDB host: ${config.get("mongoDBHost")}`)
  )
  .catch(() =>
    console.error(
      `FATAL ERROR: Can't connect to MongoDB host: ${config.get("mongoDBHost")}`
    )
  );

// START REGISTER REDDIT ACCOUNT SCRIPT
async function executeRegisterRedditScript(options) {
  const {
    currentProcess,
    currentTask,
    currentProxy,
    currentIP,
    randomKeywords,
    girlFirstnameList,
    verifyEmail,
    turnOnNSFW,
    logger,
  } = options;

  return new Promise(async (resolve, reject) => {
    // Generate random username & password
    await logToProcess(
      currentProcess,
      "Generating random username & password..."
    );
    let username = randomUsername(girlFirstnameList);
    const password = randomString(10);
    while (true) {
      try {
        let usernameAvailable = await checkUsernameAvailability(username);
        if (usernameAvailable) {
          break;
        } else {
          username = randomUsername(girlFirstnameList);
        }
      } catch (err) {
        logger.error(`${username} -> can't checkUsernameAvailability, ${err}`);
        await delay(config.get("delayPerAttemp"));
      }
    }

    // Create browser instance
    await logToProcess(currentProcess, "Instantiating goLoginBrowser...");
    let goLoginBrowser;
    let profileId;
    try {
      ({ goLoginBrowser, profileId } = await loopUntilSuccess({
        fn: createNewGologinBrowser,
        fnOptions: {
          accessToken: config.get("goLoginAPI"),
          profileName: username,
          captchaAPI: config.get("2captchaAPI"),
          proxy: {
            mode: "http",
            host: currentProxy.proxy.split(":")[0],
            port: currentProxy.proxy.split(":")[1],
          },
        },
        maxAttemps: config.get("maxAttemps"),
        delayPerAttemps: config.get("delayPerAttemp"),
        logger,
      }));
    } catch (err) {
      reject(`${username} -> can't instantiate goLoginBrowser`);
      return;
    }
    // Turn off notification
    const browserContext = goLoginBrowser.defaultBrowserContext();
    browserContext.overridePermissions("https://www.reddit.com", [
      "geolocation",
      "notifications",
    ]);

    // Try catch to shutdown browser
    try {
      // Create a new tab
      const page = await goLoginBrowser.newPage();
      // Set default timeout for all
      page.setDefaultTimeout(config.get("defaultTimeout"));

      await logToProcess(
        currentProcess,
        "Searching for random Google keyword..."
      );
      // Get a random keyword
      const randomKeyword = choice(randomKeywords).toLowerCase().trim();
      // Search google for a random keywords
      await page.goto(
        `https://www.google.com/search?q=${randomKeyword}+site:reddit.com`
      );

      // Click random reddit link on SERP
      await logToProcess(currentProcess, "Clicking a random link on SERP...");
      try {
        const serpLinks = await page.$$(
          '#rso .g a[href^="https://www.reddit.com/"]'
        );
        await choice(serpLinks).click();
      } catch (err) {
        reject(`${currentProxy.proxy}: might be a google recaptcha...`);
        await goLoginBrowser.shutdown();
        return;
      }

      await logToProcess(
        currentProcess,
        "Waiting for reddit finish loading..."
      );
      // Wait for reddit to load successfully!
      await page.waitForNavigation();

      // Scroll page a little bit
      await logToProcess(currentProcess, "Scrolling reddit for a while...");
      await scrollPage({
        page,
        scrollTimes: randint(8, 15),
        delayPerScroll: 2000,
      });

      // Click Sign up button
      await logToProcess(currentProcess, "Clicking signup button...");
      const signUpBtn = await page.waitForSelector(
        'a[href^="https://www.reddit.com/register"]'
      );
      await signUpBtn.click();

      // Wait for Register iFrame
      await logToProcess(currentProcess, "Waiting for register iFrame...");
      const frameElementHandle = await page.waitForSelector(
        'iframe[src^="https://www.reddit.com/register"]'
      );
      const registerFrame = await frameElementHandle.contentFrame();

      let emailUsername = "";
      let emailPassword = "";
      if (verifyEmail) {
        await logToProcess(currentProcess, "Getting a new email address...");
        // Get a new email address
        const email = await Email.findOneAndUpdate(
          { status: true },
          { $set: { status: false } },
          { new: true }
        );

        // Run out of email
        if (!email) {
          logger.error("No emails are available!");
          await goLoginBrowser.shutdown();
          currentTask.running = false;
          await currentTask.save();
          await currentProxy.endUsing();
          await endProcess(currentProcess);
        }

        emailUsername = email.username;
        emailPassword = email.password;

        // Type email address
        await logToProcess(currentProcess, "Filling in email address...");
        const emailInput = await registerFrame.waitForSelector(
          "input#regEmail",
          {
            visible: true,
          }
        );
        await delay(5000);
        await emailInput.press("Backspace");
        // await emailInput.type(emailUsername);
        await registerFrame.type("input#regEmail", emailUsername, {
          delay: config.get("typingDelay"),
        });
      }
      await delay(config.get("delayPerAction"));
      // Click Next button
      await logToProcess(
        currentProcess,
        "Clicking Next button (after filling email)..."
      );
      await registerFrame.waitForSelector(
        "fieldset button.AnimatedForm__submitButton",
        {
          visible: true,
        }
      );
      await registerFrame.click("fieldset button.AnimatedForm__submitButton");

      await delay(config.get("delayPerAction"));

      // Type username & password
      await logToProcess(currentProcess, "Typing username & password...");
      const usernameInput = await registerFrame.waitForSelector(
        "input#regUsername",
        {
          visible: true,
        }
      );
      await usernameInput.press("Backspace");
      // await usernameInput.type(username);
      await registerFrame.type("input#regUsername", username, {
        delay: config.get("typingDelay"),
      });
      await delay(config.get("delayPerAction"));
      const passwordInput = await registerFrame.waitForSelector(
        "input#regPassword"
      );
      await passwordInput.press("Backspace");
      // await passwordInput.type(password);
      await registerFrame.type("input#regPassword", password, {
        delay: config.get("typingDelay"),
      });
      await delay(config.get("delayPerAction"));

      // Solve captcha
      await logToProcess(currentProcess, "Solving captcha...");
      const captchaResult = await registerFrame.solveRecaptchas();
      if (captchaResult.error) {
        await logToProcess(currentProcess, "Unable to solve captcha");
        await goLoginBrowser.shutdown();
        reject(`Unable to solve catpcha ${captchaResult.error}`);
        return;
      } else {
        await logToProcess(currentProcess, "Solved captcha sucessfully");
      }

      await delay(config.get("delayPerAction"));

      // Click sign up
      await logToProcess(currentProcess, "Clicking Sign up button (final)...");
      await registerFrame.click("button.SignupButton");

      // Wait for redirection
      await logToProcess(
        currentProcess,
        "Waiting for page to load after click sign up..."
      );
      await page.waitForNavigation();

      // Select gender (Woman)
      await logToProcess(currentProcess, "Selecting gender (woman)...");
      const gender = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[1]/div/label[1]/span"
      );
      await gender.click();
      await delay(config.get("delayPerAction"));

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (select gender)..."
      );
      const continue1 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await continue1.click();
      await delay(config.get("delayPerAction"));

      // Select random topics
      await logToProcess(currentProcess, "Selecting topics...");
      for (let i = 0; i < 8; i++) {
        const currentTopic = await page.waitForXPath(
          `/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[1]/div/button[${
            Math.floor(Math.random() * 20) + 1
          }]`
        );
        await currentTopic.click();
        await delay(500);
      }
      await delay(config.get("delayPerAction"));

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (select topics)..."
      );
      const continue2 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await continue2.click();
      await delay(config.get("delayPerAction"));

      // Join some communities
      await logToProcess(currentProcess, "Joining in some communities...");
      let numCommunities = randint(2, 5);
      for (let i = 2; i <= 20; i++) {
        if (numCommunities === 0) break;
        try {
          const currentCommunity = await page.$x(
            `/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[1]/div/div[${i}]`
          );
          await currentCommunity[0].click();
          numCommunities -= 1;
          await delay(500);
        } catch (err) {}
      }
      await delay(config.get("delayPerAction"));

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (join in communities)..."
      );
      const continue3 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await continue3.click();
      await delay(config.get("delayPerAction"));

      // Select avatar
      await logToProcess(currentProcess, "Selecting avatar...");
      const continue4 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await delay(config.get("delayPerAction"));

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (select avatar)..."
      );
      await continue4.click();
      await delay(config.get("delayPerAction"));

      // Scroll for a while after sign up
      await logToProcess(currentProcess, "Scrolling for a while after sign up");
      await scrollPage({
        page,
        scrollTimes: randint(8, 15),
        delayPerScroll: 2000,
      });

      // Turn on NSFW
      if (turnOnNSFW) {
        try {
          await logToProcess(currentProcess, "Turning on NSFW...");
          // Click on account dropdown butotn
          await page.waitForSelector("button#USER_DROPDOWN_ID");
          await page.click("button#USER_DROPDOWN_ID");
          await delay(config.get("delayPerAction"));

          // Wait for user settings button
          await page.waitForSelector("a[href='/settings']");
          await page.click("a[href='/settings']");
          await delay(config.get("delayPerAction"));

          // Click on Profile
          await page.waitForSelector("a[href='/settings/profile']");
          await page.click("a[href='/settings/profile']");
          await delay(config.get("delayPerAction"));

          // NSFW Button
          const nsfwButton = await page.waitForXPath(
            "/html/body/div[1]/div/div[2]/div[2]/div/div/div[2]/div[1]/div[4]/div[2]/div/button",
            { visible: true }
          );
          await nsfwButton.click();
          await delay(config.get("delayPerAction"));

          // Feed setting
          await page.click('a[href="/settings/feed"]');
          await delay(config.get("delayPerAction"));

          // Adult content button
          const adultContentButton = await page.waitForXPath(
            "/html/body/div[1]/div/div[2]/div[2]/div/div/div[2]/div[1]/div[1]/div[2]/div/button",
            { visible: true }
          );
          await adultContentButton.click();
          await delay(config.get("delayPerAction"));
        } catch (err) {
          reject(`${username}: can't turn on NSFW ${err}`);
          await goLogin.shutdown();
          return;
        }
      }

      // Verify email
      let verification = "No";
      if (verifyEmail) {
        await logToProcess(currentProcess, "Verifying email...");
        try {
          let verificationLink;
          for (let i = 0; i < config.get("maxAttemps"); i++) {
            try {
              // Read verification email

              verificationLink = await getEmailVerificationLink({
                email: emailUsername,
                password: emailPassword,
              });
              break;
            } catch (err) {}
          }

          if (verificationLink) {
            // Go to verification link
            await page.goto(verificationLink);

            verification = "Mail Verified";
          } else {
            verification = "No";
          }
        } catch (err) {
          await logToProcess(currentProcess, "Failed to verify email...");
          logger.error(
            `${username} -> can't verify email ${emailUsername}, Reason: ${err}`
          );
        }
      }

      await logToProcess(currentProcess, "Exporting cookies...");
      let cookies = await page.cookies();
      cookies = JSON.stringify(cookies);

      // Create new account object
      const account = new Account({
        username: username,
        password: password,
        email: emailUsername,
        passmail: emailPassword,
        cookies: cookies,
        IP: currentIP,
        verification: verification,
      });
      resolve(account);
    } catch (err) {
      // Uncaught error
      reject(`Uncaught error ${err}`);
    } finally {
      await goLoginBrowser.close();
    }
  });
}
// END REGISTER REDDIT ACCOUNT SCRIPT

// APPLICATION STARTS HERE
async function main() {
  // Initialize setup
  const {
    currentProcess,
    currentTask,
    currentProxy,
    randomKeywords,
    girlFirstnameList,
    logger,
  } = await setup();

  // LOOP TO CREATE REDDIT ACCOUNTS CONTINUOUSLY
  while (true) {
    // Check if any task is running otherwise kill the process
    await currentTask.update();
    if (!currentTask.running) {
      await endProcess(currentProcess);
    }

    // Update current xProxy fields (used, using)
    for (let i = 0; i < config.get("maxAttemps"); i++) {
      try {
        await currentProxy.startUsing();
        break;
      } catch (err) {
        logToProcess(currentProcess, err);
        await delay(config.get("delayPerAttemp"));
      }
      if (i === config.get("maxAttemps") - 1) {
        logger.error(
          `${currentProxy.proxy} -> is rotating, exceeded max attemps to wait.`
        );
        endProcess(currentProcess);
      }
    }

    // Rotate xProxy if needed
    for (let i = 0; i < config.get("maxAttemps"); i++) {
      try {
        await currentProxy.rotateIfNeeded({
          workerId: cluster.worker.id,
          numProcesses: currentTask.numProcesses,
        });
        break;
      } catch (err) {
        logToProcess(currentProcess, err);
        await delay(config.get("delayPerAttemp"));
      }
      if (i === config.get("maxAttemps") - 1) {
        endProcess(currentProcess);
      }
    }

    // Get current IP
    let currentIP = "";
    for (let i = 0; i < config.get("maxAttemps"); i++) {
      try {
        currentIP = await currentProxy.getCurrentIP();
        break;
      } catch (err) {
        logToProcess(currentProcess, err);
        logger.error(err);
        await delay(config.get("delayPerAttemp"));
      }
      if (i === config.get("maxAttemps") - 1) {
        endProcess(currentProcess);
      }
    }

    currentProcess.currentIP = currentIP;
    await currentProcess.save();

    try {
      // INSERT REGISTER REDDIT SCRIPT
      const registeredAccount = await executeRegisterRedditScript({
        currentProcess,
        currentTask,
        currentProxy,
        currentIP,
        randomKeywords,
        girlFirstnameList,
        verifyEmail: config.get("verifyEmail"),
        turnOnNSFW: config.get("turnOnNSFW"),
        logger,
      });
      logToProcess(currentProcess, "Saving account to DB...");
      await registeredAccount.save();
      // END INSERT

      // Notify Task that's i'm succeeded
      await currentTask.update();
      await currentTask.succeed();
    } catch (err) {
      logger.error(`Failed to register account: ${err}`);

      // Notify Task that's i'm failed
      await currentTask.update();
      await currentTask.fail();
    } finally {
      // Update running
      await currentProxy.endUsing();
    }
  }
}

// Log to Process
async function logToProcess(process, message) {
  process.status = message;
  await process.save();
}

// Delete & kill process
async function endProcess(currentProcess) {
  await currentProcess.remove();
  process.exit();
}

// INITIALIZE SETUP
async function setup() {
  return new Promise(async (resolve, reject) => {
    const logger = new Logger(config.get("logPath"));

    try {
      // Create a new Process
      const currentProcess = new Process({
        workerId: cluster.worker.id,
        pid: process.pid,
      });
      await currentProcess.save();

      // Get current Task
      const currentTask = await Task.findOne({ running: true });
      if (!currentTask) {
        await endProcess(currentProcess);
      }

      // SELECT PROXY TYPE DEPENDS ON CONFIG FILE
      // THE METHODS KEEP SAME NAME TO USE
      let currentProxy;
      if (config.get("proxyType") == "xProxy") {
        currentProxy = await xProxy.getProxyByWorkerId(cluster.worker.id);
      }

      if (!currentProxy) {
        await endProcess(currentProcess);
      }

      // Save to process
      currentProcess.proxy = currentProxy.proxy;
      await currentProcess.save();

      // Load necessary list
      const randomKeywords = txtToArray(config.get("randomKeywordsPath"));
      const girlFirstnameList = txtToArray(config.get("girlFirstnameListPath"));

      resolve({
        currentProcess,
        currentTask,
        currentProxy,
        randomKeywords,
        girlFirstnameList,
        logger,
      });
    } catch (err) {
      reject("Can't initialize setup, ", err);
      logger.error("Can't initialize setup, ", err);
      process.exit();
    }
  });
}

main();
