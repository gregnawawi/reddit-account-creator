const { installMouseHelper } = require("ghost-cursor");
const { delay } = require("./otherUtil");
const { randint } = require("./randomUtil");

// Scroll page
async function scrollPage(options) {
  const { page, minTime, maxTime } = options;
  const scrollTimes = randint(minTime, maxTime) / randint(500, 800);
  return new Promise(async (resolve, reject) => {
    try {
      for (let i = 0; i < scrollTimes; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, Math.floor(Math.random() * (350 - 150 + 1)) + 150);
        });
        await delay(randint(500, 800));
      }
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

async function simKeyboardType(options) {
  const { page, text, pauseAfterLastKeyUp = true } = options;

  const needsShiftKey = '~!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:"ZXCVBNM<>?';

  for (let ch of text) {
    let needsShift = false;
    if (needsShiftKey.includes(ch)) {
      needsShift = true;
      await page.keyboard.down("ShiftLeft");
      await delay(randint(500, 1000));
    }

    await page.keyboard.type("" + ch, { delay: randint(30, 100) });

    if (needsShift) {
      await delay(150, 450);
      await page.keyboard.up("ShiftLeft");
    }

    await delay(30, 100);

    if (pauseAfterLastKeyUp) {
      await delay(300, 1000);
    }
  }
}

async function simKeyboardPress(options) {
  const { page, text, pauseAfterKeyUp = true } = options;

  await page.keyboard.press(text);
  if (pauseAfterKeyUp) {
    await delay(300, 1000);
  }
}

module.exports = {
  scrollPage,
  simKeyboardPress,
  simKeyboardType,
};
