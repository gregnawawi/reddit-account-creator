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

module.exports = {
  scrollPage,
};
