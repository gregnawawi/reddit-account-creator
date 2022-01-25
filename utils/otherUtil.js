// Wait for x (miliseconds)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Execute a function until it succeeds
// fn: function name
// fnOptions: 1 arugment -> OK, Multiple arguments -> Pass an options object
async function loopUntilSuccess(options) {
  const {
    fn,
    fnOptions = null,
    maxAttemps,
    delayPerAttemp,
    logger = console,
  } = options;
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < maxAttemps; i++) {
      try {
        if (fnOptions) {
          resolve(await fn(fnOptions));
        } else {
          resolve(await fn());
        }
        return;
      } catch (err) {
        logger.error(err);

        await delay(delayPerAttemp);
      }
    }
    reject(`${fn.name}: Failed to loop until success`);
  });
}

module.exports = {
  delay,
  loopUntilSuccess,
};
