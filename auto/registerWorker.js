const config = require("config");
const cluster = require("cluster");
const mongoose = require("mongoose");
const { Account } = require("../models/account");
const { Task } = require("../models/task");
const { xProxy } = require("../models/xproxy");
const { Process } = require("../models/process");
const { Email } = require("../models/email");
const { delay } = require("../utils/otherUtil");
const { txtToArray } = require("../utils/fileUtil");
const {
  scrollPage,
  simKeyboardPress,
  simKeyboardType,
} = require("../utils/puppeteerUtil");
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
const {
  createCursor,
  getRandomPagePoint,
  installMouseHelper,
} = require("ghost-cursor");

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

// START REGISTER REDDIT ACCOUNT SCRIPT (OLD REDDIT)
async function executeRegisterRedditScriptV3(options) {
  const {
    currentProcess,
    currentTask,
    currentProxy,
    currentIP,
    girlFirstnameList,
    goLoginAPI,
    captchaAPI,
    chromeProfilesPath,
    maxAttemps,
    delayPerAttemp,
    delayPerAction,
    defaultTimeout,
    headless,
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
            headless,
            workerId: cluster.worker.id,
          }
        ));
        break;
      } catch (err) {
        logger.error(err);
        try {
          await goLoginBrowser.close();
          await goLogin.stopLocal();
          await goLogin.stopBrowser();
        } catch (err) {}
        if (i == maxAttemps - 1) {
          await currentProxy.endUsing();
          await endProcess(currentProcess);
        }
        await delay(delayPerAttemp);
      }
    }

    try {
      const page = await goLoginBrowser.newPage();
      await delay(300);
      // Set default timeout for all
      page.setDefaultTimeout(defaultTimeout);

      // Fix puppeteer screen size
      const viewPort = goLogin.getViewPort();
      await page.setViewport({
        width: Math.round(viewPort.width * 0.994),
        height: Math.round(viewPort.height * 0.92),
        isLandscape: true,
      });
      const session = await page.target().createCDPSession();
      const { windowId } = await session.send("Browser.getWindowForTarget");
      await session.send("Browser.setWindowBounds", {
        windowId,
        bounds: viewPort,
      });
      await session.detach();

      // Create ghost-cursor
      const cursor = createCursor(page, await getRandomPagePoint(page));
      await installMouseHelper(page); // Show mouse circle

      await page.goto("https://old.reddit.com/login", {
        waitUntil: ["networkidle2"],
      });

      // Click Username input
      await delay(randint(3000, 8000));
      await logToProcess(currentProcess, "Typing username...");
      await cursor.click("input#user_reg", {
        paddingPercentage: 20,
      });
      await simKeyboardType({ page, text: username });

      // Click password input
      await delay(randint(2000, 5000));
      await logToProcess(currentProcess, "Typing password...");
      await cursor.click("input#passwd_reg", {
        paddingPercentage: 20,
      });
      await simKeyboardType({ page, text: password });

      // Click verify password input
      await delay(randint(2000, 5000));
      await logToProcess(currentProcess, "Typing confirm password...");
      await cursor.click("input#passwd2_reg", {
        paddingPercentage: 20,
      });
      await simKeyboardType({ page, text: password });

      await delay(randint(2000, 5000));

      let emailUsername = "";
      let emailPassword = "";

      // Solve captcha
      await logToProcess(currentProcess, "Solving captcha...");
      const captchaResult = await page.solveRecaptchas();
      if (captchaResult.error) {
        await logToProcess(currentProcess, "Unable to solve captcha");
        await goLoginBrowser.close();
        await goLogin.stopLocal();
        await goLogin.stopBrowser(); // Testing
        reject(`Unable to solve captcha ${captchaResult.error.error}`);
        return;
      } else {
        await logToProcess(currentProcess, "Solved captcha sucessfully");
      }
      await delay(delayPerAction);

      // Click sign up
      await cursor.click(
        "//button[@type='submit' and contains(text(), 'sign up')]",
        {
          paddingPercentage: 20,
        }
      );

      await page.waitForNavigation();

      // Turn on NSFW
      let NSFW = false;

      // Verify email
      let mailVerified = false;

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
        mailVerified,
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
        await goLogin.stopLocal();
        await goLogin.stopBrowser(); // Testing
      } catch (err) {}
    }
  });
}
// END REGISTER REDDIT ACCOUNT SCRIPT

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
            headless,
            workerId: cluster.worker.id,
          }
        ));
        break;
      } catch (err) {
        logger.error(err);
        try {
          await goLoginBrowser.close();
          await goLogin.stopLocal();
          await goLogin.stopBrowser();
        } catch (err) {}
        if (i == maxAttemps - 1) {
          await currentProxy.endUsing();
          await endProcess(currentProcess);
        }
        await delay(delayPerAttemp);
      }
    }

    // Turn off browser notification
    // const browserContext = goLoginBrowser.defaultBrowserContext();
    // browserContext.overridePermissions("https://www.reddit.com", [
    //   "geolocation",
    //   "notifications",
    // ]);

    try {
      const page = await goLoginBrowser.newPage();
      await delay(300);

      // Set default timeout for all
      page.setDefaultTimeout(defaultTimeout);

      // Fix puppeteer screen size
      const viewPort = goLogin.getViewPort();
      await page.setViewport({
        width: Math.round(viewPort.width * 0.994),
        height: Math.round(viewPort.height * 0.92),
        isLandscape: true,
      });
      const session = await page.target().createCDPSession();
      const { windowId } = await session.send("Browser.getWindowForTarget");
      await session.send("Browser.setWindowBounds", {
        windowId,
        bounds: viewPort,
      });
      await session.detach();

      // Create ghost-cursor
      const cursor = createCursor(page, await getRandomPagePoint(page));
      await installMouseHelper(page); // Show mouse circle

      await page.goto("https://www.reddit.com", {
        waitUntil: ["networkidle2"],
      });

      await logToProcess(currentProcess, "Scrolling reddit for a while...");
      await scrollPage({
        page,
        minTime: 3000,
        maxTime: 5000,
      });

      // Click Sign up button
      await delay(randint(600, 1000));
      await logToProcess(currentProcess, "Clicking signup button...");
      await cursor.click('a[href^="https://www.reddit.com/register"]', {
        paddingPercentage: 20,
      });

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
          await goLogin.stopLocal();
          await goLogin.stopBrowser(); // Testing
          currentTask.running = false;
          await currentTask.save();
          await currentProxy.endUsing();
          await endProcess(currentProcess);
        }
        emailUsername = email.username;
        emailPassword = email.password;

        // Type email address
        await delay(randint(2000, 6000));
        await logToProcess(currentProcess, "Filling in email address...");
        const emailInput = await registerFrame.waitForSelector(
          "input#regEmail",
          {
            visible: true,
          }
        );
        await cursor.click(emailInput, { paddingPercentage: 20 });
        await simKeyboardType({ page, text: emailUsername });
      }
      await delay(randint(6000, 15000));

      // Click Next button
      await logToProcess(
        currentProcess,
        "Clicking Next button (after filling email)..."
      );
      const nextAfterFillMailBtn = await registerFrame.waitForSelector(
        "fieldset button.AnimatedForm__submitButton",
        {
          visible: true,
        }
      );
      await delay(randint(2000, 6000));
      await cursor.click(nextAfterFillMailBtn, { paddingPercentage: 20 });
      await delay(randint(4000, 8000));

      // Type username & password
      await logToProcess(currentProcess, "Typing username & password...");
      const usernameInput = await registerFrame.waitForSelector(
        "input#regUsername",
        {
          visible: true,
        }
      );
      await cursor.click(usernameInput, { paddingPercentage: 20 });
      await simKeyboardType({ page, text: username });
      await delay(randint(1000, 2000));
      const passwordInput = await registerFrame.waitForSelector(
        "input#regPassword"
      );
      await cursor.click(passwordInput, { paddingPercentage: 20 });
      await simKeyboardType({ page, text: password });
      await delay(randint(800, 2000));

      // Solve captcha
      await logToProcess(currentProcess, "Solving captcha...");
      const captchaResult = await registerFrame.solveRecaptchas();
      if (captchaResult.error) {
        await logToProcess(currentProcess, "Unable to solve captcha");
        await goLoginBrowser.close();
        await goLogin.stopLocal();
        await goLogin.stopBrowser(); // Testing
        reject(`Unable to solve captcha ${captchaResult.error.error}`);
        return;
      } else {
        await logToProcess(currentProcess, "Solved captcha sucessfully");
      }
      await delay(delayPerAction);

      // Check if there's any invalid message
      const invalidMessages = await registerFrame.$x(
        "//div[contains(text(), 'already taken') or contains(text(), 'characters long') or contains(text(), 'characters in length')]"
      );
      // If yes, re-type username & password
      if (invalidMessages.length != 0) {
        await cursor.click(usernameInput, { paddingPercentage: 20 });
        await delay(randint(1000, 2500));
        await page.keyboard.down("Control");
        await delay(randint(500, 1000));
        await page.keyboard.press("A");
        await delay(randint(500, 1000));
        await page.keyboard.up("Control");
        await delay(randint(500, 1000));
        await page.keyboard.press("Backspace");
        await delay(randint(500, 1000));
        await simKeyboardType({ page, text: username });
        await delay(randint(1000, 2000));

        await cursor.click(passwordInput, { paddingPercentage: 20 });
        await delay(randint(1000, 2500));
        await page.keyboard.down("Control");
        await delay(randint(500, 1000));
        await page.keyboard.press("A");
        await delay(randint(500, 1000));
        await page.keyboard.up("Control");
        await delay(randint(500, 1000));
        await page.keyboard.press("Backspace");
        await delay(randint(500, 1000));
        await simKeyboardType({ page, text: password });
        await delay(randint(2000, 5000));
      }

      // Click sign up
      await logToProcess(currentProcess, "Clicking Sign up button (final)...");
      const firstSignupBtn = await registerFrame.waitForSelector(
        "button.SignupButton"
      );
      await cursor.click(firstSignupBtn, { paddingPercentage: 20 });
      await delay(randint(800, 2000));

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
          await goLogin.stopLocal();
          await goLogin.stopBrowser(); // Testing
          return;
        }
      } catch (err) {}

      // Select gender
      await logToProcess(currentProcess, "Selecting gender...");
      const gender = await page.waitForXPath(
        "//span[contains(text(), 'Woman')]"
      );
      await cursor.click(gender, { paddingPercentage: 20 });
      await delay(randint(2000, 5000));

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (select gender)..."
      );
      const continue1 = await page.waitForXPath(
        "//button[contains(text(), 'Continue')]"
      );
      await cursor.click(continue1, { paddingPercentage: 20 });
      await delay(randint(2000, 5000));

      // Select random topics
      const selectedTopics = [];
      await logToProcess(currentProcess, "Selecting topics...");
      for (let i = 0; i < 6; i++) {
        const currentTopicId = randint(1, 15);
        const currentTopic = await page.waitForXPath(
          `/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[1]/div/button[${currentTopicId}]`
        );
        const topicName = await (
          await currentTopic.getProperty("textContent")
        ).jsonValue();
        if (selectedTopics.indexOf(topicName) == -1) {
          selectedTopics.push(topicName);
          await cursor.click(currentTopic, { paddingPercentage: 20 });
        }
        await delay(randint(700, 1500));
      }
      await delay(randint(2000, 5000));

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (select topics)..."
      );
      const continue2 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await cursor.click(continue2, { paddingPercentage: 20 });
      await delay(randint(2000, 5000));

      // Join some communities
      await logToProcess(currentProcess, "Joining in some communities...");
      let numCommunities = randint(2, 5);
      for (let i = 2; i <= 20; i++) {
        if (numCommunities === 0) break;
        try {
          const currentCommunity = await page.$x(
            `/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[1]/div/div[${i}]`
          );
          await cursor.click(currentCommunity[0], { paddingPercentage: 20 });
          numCommunities -= 1;
          await delay(randint(500, 1000));
        } catch (err) {}
      }
      await delay(randint(2000, 5000));

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (join in communities)..."
      );
      const continue3 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await cursor.click(continue3, { paddingPercentage: 20 });
      await delay(randint(2000, 5000));

      // Select avatar
      await logToProcess(currentProcess, "Selecting avatar...");
      const continue4 = await page.waitForXPath(
        "/html/body/div[1]/div/div[2]/div[4]/div/div/div/div[2]/button"
      );
      await delay(randint(2000, 5000));

      // Click continue
      await logToProcess(
        currentProcess,
        "Clicking continue (select avatar)..."
      );
      await cursor.click(continue4, { paddingPercentage: 20 });
      await delay(randint(2000, 5000));

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
          // Click on account dropdown button
          await cursor.click("button#USER_DROPDOWN_ID", {
            paddingPercentage: 20,
          });
          await delay(randint(2000, 5000));

          // Wait for user settings button
          await cursor.click("a[href^='/settings']", { paddingPercentage: 20 });
          await delay(randint(2000, 5000));

          // Click on Profile
          await cursor.click("a[href^='/settings/profile']", {
            paddingPercentage: 20,
          });
          await delay(randint(2000, 5000));

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
            await cursor.click(nsfwButton, { paddingPercentage: 20 });
          }

          await delay(randint(2000, 5000));

          // Turn on "Adult content"
          await cursor.click('a[href^="/settings/feed"]', {
            paddingPercentage: 20,
          });
          await delay(randint(2000, 5000));
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
            await cursor.click(adultContentButton, { paddingPercentage: 20 });
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
            await cursor.click(markdownButton, { paddingPercentage: 20 });
            await delay(randint(2000, 5000));
          }
        } catch (err) {
          NSFW = false;
        }
      }

      // Verify email
      let mailVerified = false;
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

            mailVerified = true;
          } else {
            mailVerified = false;
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
        mailVerified,
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
        await goLogin.stopLocal();
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
      const registeredAccount = await executeRegisterRedditScriptV3({
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
      // const registeredAccount = await executeRegisterRedditScriptV3({
      //   currentProcess,
      //   currentTask,
      //   currentProxy,
      //   currentIP,
      //   girlFirstnameList,
      //   verifyEmail: config.get("verifyEmail"),
      //   turnOnNSFW: config.get("turnOnNSFW"),
      //   headless: config.get("headless"),
      //   maxAttemps: config.get("maxAttemps"),
      //   delayPerAttemp: config.get("delayPerAttemp"),
      //   delayPerAction: config.get("delayPerAction"),
      //   goLoginAPI: config.get("goLoginAPI"),
      //   captchaAPI: config.get("2captchaAPI"),
      //   chromeProfilesPath: config.get("chromeProfilesPath"),
      //   defaultTimeout: config.get("defaultTimeout"),
      //   typingDelay: config.get("typingDelay"),
      //   logger,
      // });
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
