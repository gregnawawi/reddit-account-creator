// Scroll page
async function scrollPage(options) {
  const { page, scrollTimes, delayPerScroll } = options;
  return new Promise(async (resolve, reject) => {
    try {
      for (let i = 0; i < scrollTimes; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, 350);
        });
        await page.waitForTimeout(delayPerScroll);
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
