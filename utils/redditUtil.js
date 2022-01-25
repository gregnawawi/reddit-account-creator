const { getLatestHotmail } = require("./mailUtil");
const { request } = require("undici");

// Check reddit username available
async function checkUsernameAvailability(username) {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await request(
        `https://www.reddit.com/api/username_available.json?user=${username}`
      );
      const responseJson = await response.body.json();

      if (responseJson) {
        resolve(true);
      } else {
        resolve(false);
      }
    } catch (err) {
      reject(err);
    }
  });
}

// Get reddit email verification link
async function getEmailVerificationLink(options) {
  const { email, password } = options;
  return new Promise(async (resolve, reject) => {
    try {
      let result = await getLatestHotmail(email, password);
      const verificationLinkPattern =
        /(https:\/\/www.reddit.com\/verification\/[a-zA-Z0-9?_\-=&;]*)/;

      let link = result.match(verificationLinkPattern);
      if (link == null) {
        // Try to read Junk folder
        result = await getLatestHotmail(email, password, "Junk");
        link = result.match(verificationLinkPattern);
        if (link == null) {
          reject(`${email}: Can't find reddit verification link`);
        } else {
          resolve(link[0]);
        }
      } else {
        resolve(link[0]);
      }
    } catch (err) {
      reject(`${email}: Can't find reddit verification link, ${err}`);
    }
  });
}

module.exports = {
  checkUsernameAvailability,
  getEmailVerificationLink,
};
