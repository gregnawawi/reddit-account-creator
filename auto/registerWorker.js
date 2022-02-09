const config = require("config");
const cluster = require("cluster");
const mongoose = require("mongoose");
const events = require("events");
const { Account } = require("../models/account");
const { Task } = require("../models/task");
const { xProxy } = require("../models/xproxy");
const { Process } = require("../models/process");
const { Email } = require("../models/email");
const { delay } = require("../utils/otherUtil");
const { txtToArray } = require("../utils/fileUtil");
const { scrollPage } = require("../utils/puppeteerUtil");
const {
  getEmailVerificationLink,
  checkUsernameAvailability,
} = require("../utils/redditUtil");
const {
  randomString,
  randomUsername,
  randint,
} = require("../utils/randomUtil");
const { Logger } = require("../utils/logUtil");
const { createNewGologinBrowser } = require("../utils/gologinUtil");

// Fix Max Listener Exceeded
// process.setMaxListeners(0);
const emitter = new events.EventEmitter();
emitter.setMaxListeners(0);

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
    girlFirstnameList,
    verifyEmail,
    turnOnNSFW,
    goLoginAPI,
    captchaAPI,
    chromeProfilesPath,
    maxAttemps,
    delayPerAttemp,
    delayPerAction,
    defaultTimeout,
    headless,
    typingDelay,
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
        await delay(delayPerAttemp);
      }
    }

    // Create browser instance
    await logToProcess(currentProcess, "Instantiating goLoginBrowser...");
    let goLoginBrowser;
    let profileId;
    let goLogin;
    for (let i = 0; i < maxAttemps; i++) {
      try {
        ({ goLoginBrowser, profileId, goLogin } = await createNewGologinBrowser(
          {
            accessToken: goLoginAPI,
            profileName: username,
            captchaAPI,
            proxy: {
              mode: "http",
              host: currentProxy.proxy.split(":")[0],
              port: currentProxy.proxy.split(":")[1],
            },
            tmpdir: chromeProfilesPath,
            headless: headless,
            workerId: cluster.worker.id,
          }
        ));
        break;
      } catch (err) {
        logger.error(err);
        try {
          await goLoginBrowser.close();
          await goLogin.stop();
          await goLogin.stopBrowser(); // Testing
        } catch (err) {}
        if (i == maxAttemps - 1) {
          await currentProxy.endUsing();
          await endProcess(currentProcess);
        }
        await delay(delayPerAttemp);
      }
    }

    // Turn off browser notification
    const browserContext = goLoginBrowser.defaultBrowserContext();
    browserContext.overridePermissions("https://www.reddit.com", [
      "geolocation",
      "notifications",
    ]);
    goLoginBrowser.setMaxListeners(0);

    try {
      const page = await goLoginBrowser.newPage();
      page.setMaxListeners(0);
      // Set default timeout for all
      page.setDefaultTimeout(defaultTimeout);

      await page.goto("https://www.reddit.com");
      await logToProcess(currentProcess, "Scrolling reddit for a while...");
      await scrollPage({
        page,
        minTime: 15000,
        maxTime: 20000,
      });

      // Click Sign up button
      await logToProcess(currentProcess, "Clicking signup button...");
      const signUpBtn = await page.waitForSelector(
        'a[href^="https://www.reddit.com/register"]'
      );
      await signUpBtn.click();

      // Get register iframe
      await logToProcess(currentProcess, "Getting register iframe...");
      const frameElementHandle = await page.waitForSelector(
        'iframe[src^="https://www.reddit.com/register"]'
      );
      const registerFrame = await frameElementHandle.contentFrame();

      let emailUsername = "";
      let emailPassword = "";
      if (verifyEmail) {
        // Get a new email address
        await logToProcess(currentProcess, "Getting a new email address...");
        const email = await Email.findOneAndUpdate(
          { status: true },
          { $set: { status: false } },
          { new: true }
        );
        if (!email) {
          logger.error("No emails are available!");
          await goLoginBrowser.close();
          await goLogin.stop();
          await goLogin.stopBrowser(); // Testing
          currentTask.running = false;
          await currentTask.save();
          await currentProxy.endUsing();
          await endProcess(currentProcess);
        }
        emailUsername = email.username;
        emailPassword = email.password;

        // Type email address
        await delay(delayPerAction * 2);
        await logToProcess(currentProcess, "Filling in email address...");
        const emailInput = await registerFrame.waitForSelector(
          "input#regEmail",
          {
            visible: true,
          }
        );
        await emailInput.click();
        await emailInput.press("Backspace");
        await emailInput.type(emailUsername, {
          delay: typingDelay,
        });
      }
      await delay(delayPerAction * 3);

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
      await delay(delayPerAction * 3);

      // Type username & password
      await logToProcess(currentProcess, "Typing username & password...");
      const usernameInput = await registerFrame.waitForSelector(
        "input#regUsername",
        {
          visible: true,
        }
      );
      await usernameInput.click();
      await usernameInput.press("Backspace");
      await usernameInput.type(username, {
        delay: typingDelay,
      });
      await delay(delayPerAction);
      const passwordInput = await registerFrame.waitForSelector(
        "input#regPassword"
      );
      await passwordInput.click();
      await passwordInput.press("Backspace");
      await passwordInput.type(password, {
        delay: typingDelay,
      });
      await delay(delayPerAction);

      // Solve captcha
      await logToProcess(currentProcess, "Solving captcha...");
      const captchaResult = await registerFrame.solveRecaptchas();
      if (captchaResult.error) {
        await logToProcess(currentProcess, "Unable to solve captcha");
        await goLoginBrowser.close();
        await goLogin.stop();
        await goLogin.stopBrowser(); // Testing
        reject(`Unable to solve captcha ${captchaResult.error.error}`);
        return;
      } else {
        await logToProcess(currentProcess, "Solved captcha sucessfully");
      }
      await delay(delayPerAction);

      // Check if there's any invalid message
      const invalidMessages = await registerFrame.$x(
        "//div[contains(text(), 'already taken') or contains(text(), 'characters long')]"
      );
      // If yes, re-type username & password
      if (invalidMessages.length != 0) {
        await usernameInput.click();
        const currentUsernameValue = await registerFrame.evaluate(
          (el) => el.value,
          usernameInput
        );
        for (let i = 0; i < currentUsernameValue.length; i++) {
          await page.keyboard.press("Backspace");
        }
        await usernameInput.type(username, {
          delay: typingDelay,
        });
        await delay(delayPerAction);

        await passwordInput.click();
        const currentPasswordValue = await registerFrame.evaluate(
          (el) => el.value,
          passwordInput
        );
        for (let i = 0; i < currentPasswordValue.length; i++) {
          await page.keyboard.press("Backspace");
        }
        await passwordInput.type(password, {
          delay: typingDelay,
        });
        await delay(delayPerAction);
      }

      // Click sign up
      await logToProcess(currentProcess, "Clicking Sign up button (final)...");
      await registerFrame.click("button.SignupButton");
      await delay(delayPerAction);

      // If error messages show up, quit immediately
      try {
        const bottomBarMsgXpath = await registerFrame.$x(
          "/html/body/div[1]/main/div[2]/div/div/div[3]/span/span[2]"
        );
        const bottomBarMsg = await (
          await bottomBarMsgXpath[0].getProperty("textContent")
        ).jsonValue();
        if (bottomBarMsg) {
          reject(`Something went wrong: ${bottomBarMsg}`);
          await goLoginBrowser.close();
          await goLogin.stop();
          await goLogin.stopBrowser(); // Testing
          return;
        }
      } catch (err) {}

      // Select gender
      await logToProcess(currentProcess, "Selecting gender...");
      const gender = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[1]/div/label[1]/span"
      );
      await gender.click();
      await delay(delayPerAction);

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (select gender)..."
      );
      const continue1 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await continue1.click();
      await delay(delayPerAction);

      // Select random topics
      const selectedTopics = [];
      await logToProcess(currentProcess, "Selecting topics...");
      for (let i = 0; i < 8; i++) {
        const currentTopicId = randint(1, 20);
        const currentTopic = await page.waitForXPath(
          `/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[1]/div/button[${currentTopicId}]`
        );
        const topicName = await (
          await currentTopic.getProperty("textContent")
        ).jsonValue();
        if (selectedTopics.indexOf(topicName) == -1) {
          selectedTopics.push(topicName);
          await currentTopic.click();
        }
        await delay(500);
      }
      await delay(delayPerAction);

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (select topics)..."
      );
      const continue2 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await continue2.click();
      await delay(delayPerAction);

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
      await delay(delayPerAction);

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (join in communities)..."
      );
      const continue3 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await continue3.click();
      await delay(delayPerAction);

      // Select avatar
      await logToProcess(currentProcess, "Selecting avatar...");
      const continue4 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await delay(delayPerAction);

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (select avatar)..."
      );
      await continue4.click();
      await delay(delayPerAction);

      // Wait for the modal to disappear
      await page.waitForXPath("/html/body/div[1]/div/div[2]/div[4]/div/div", {
        hidden: true,
      });

      // Scroll for a while after sign up
      await logToProcess(currentProcess, "Scrolling for a while after sign up");
      await scrollPage({
        page,
        minTime: 15000,
        maxTime: 20000,
      });

      // Turn on NSFW
      let NSFW = false;
      if (turnOnNSFW) {
        try {
          await logToProcess(currentProcess, "Turning on NSFW...");
          // Click on account dropdown butotn
          await page.waitForSelector("button#USER_DROPDOWN_ID");
          await page.click("button#USER_DROPDOWN_ID");
          await delay(config.get("delayPerAction"));

          // Wait for user settings button
          await page.waitForSelector("a[href^='/settings']");
          await page.click("a[href^='/settings']");
          await delay(config.get("delayPerAction"));

          // Click on Profile
          await page.waitForSelector("a[href^='/settings/profile']");
          await page.click("a[href^='/settings/profile']");
          await delay(config.get("delayPerAction"));

          // Wait for NSFW Label to get ID of that button
          const nsfwLabel = await page.waitForXPath('//h3[text()="NSFW"]/..');
          const nsfwLabelForValue = await page.evaluate(
            (el) => el.getAttribute("for"),
            nsfwLabel
          );

          // Check if it's already on
          const nsfwButton = await page.waitForXPath(
            `//button[@id='${nsfwLabelForValue}']`
          );
          const nsfwTurnedOn = await page.evaluate(
            (el) => el.getAttribute("aria-checked"),
            nsfwButton
          );

          if (nsfwTurnedOn != "true") {
            await nsfwButton.click();
          }

          await delay(config.get("delayPerAction"));

          // Turn on "Adult content"
          await page.click('a[href^="/settings/feed"]');
          await delay(config.get("delayPerAction"));
          // Wait for Adult Content Label to get ID of that button
          const adultContentLabel = await page.waitForXPath(
            '//h3[text()="Adult content"]/..'
          );
          const adultContentLabelForValue = await page.evaluate(
            (el) => el.getAttribute("for"),
            adultContentLabel
          );
          // Check if it's already on
          const adultContentButton = await page.waitForXPath(
            `//button[@id='${adultContentLabelForValue}']`
          );
          const adultContentTurnedOn = await page.evaluate(
            (el) => el.getAttribute("aria-checked"),
            adultContentButton
          );

          if (adultContentTurnedOn != "true") {
            await adultContentButton.click();
            await delay(config.get("delayPerAction"));
          }
          NSFW = true;
          // Turn on default markdown
          // Wait for markdown Label to get ID of that button
          const markdownLabel = await page.waitForXPath(
            '//h3[contains(text(),"markdown")]/..'
          );
          const markdownLabelForValue = await page.evaluate(
            (el) => el.getAttribute("for"),
            markdownLabel
          );
          // Check if it's already on
          const markdownButton = await page.waitForXPath(
            `//button[@id='${markdownLabelForValue}']`
          );
          const markdownTurnedOn = await page.evaluate(
            (el) => el.getAttribute("aria-checked"),
            markdownButton
          );

          if (markdownTurnedOn != "true") {
            await markdownButton.click();
            await delay(config.get("delayPerAction"));
          }
        } catch (err) {
          NSFW = false;
        }
      }

      // Verify email
      let verification = "No";
      if (verifyEmail) {
        await logToProcess(currentProcess, "Verifying email...");
        try {
          let verificationLink;
          for (let i = 0; i < maxAttemps; i++) {
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

      // Export cookies
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
        profileId: profileId,
        NSFW,
        note: currentTask.note,
      });
      resolve(account);
    } catch (err) {
      // Uncaught error
      reject(`Uncaught error ${err}`);
    } finally {
      try {
        await goLoginBrowser.close();
        await goLogin.stop();
        await goLogin.stopBrowser(); // Testing
      } catch (err) {}
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
        await currentProxy.endUsing();
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
        await currentProxy.endUsing();
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
        await currentProxy.endUsing();
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
        girlFirstnameList,
        verifyEmail: config.get("verifyEmail"),
        turnOnNSFW: config.get("turnOnNSFW"),
        headless: config.get("headless"),
        maxAttemps: config.get("maxAttemps"),
        delayPerAttemp: config.get("delayPerAttemp"),
        delayPerAction: config.get("delayPerAction"),
        goLoginAPI: config.get("goLoginAPI"),
        captchaAPI: config.get("2captchaAPI"),
        chromeProfilesPath: config.get("chromeProfilesPath"),
        defaultTimeout: config.get("defaultTimeout"),
        typingDelay: config.get("typingDelay"),
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
      // THE METHODS KEEP SAME NAME TO RE-USE
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
      const girlFirstnameList = txtToArray(config.get("girlFirstnameListPath"));

      resolve({
        currentProcess,
        currentTask,
        currentProxy,
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
