const { ImapFlow } = require("imapflow");

const HOTMAIL_HOST = "imap-mail.outlook.com";

// Return latest mail of Hotmail (string)
async function getLatestHotmail(email, password, folder = "Inbox") {
  return new Promise(async (resolve, reject) => {
    const client = new ImapFlow({
      host: HOTMAIL_HOST,
      port: 993,
      secure: true,
      auth: {
        user: email,
        pass: password,
      },
      logger: false,
    });

    // Login
    await client.connect();

    // Access mail folder (Inbox, Junk,...)
    let lock = await client.getMailboxLock(folder);

    try {
      // Get latest mail
      let message = await client.fetchOne(client.mailbox.exists, {
        source: true,
      });

      resolve(message.source.toString());
    } catch (err) {
      reject(`${email}: Can't get latest hotmail! ${err}`);
    } finally {
      lock.release();
    }

    await client.logout();
  });
}

module.exports = {
  getLatestHotmail,
};
