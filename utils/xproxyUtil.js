const { request } = require("undici");

// Get current IP
async function getXProxyIP(proxy) {
  return new Promise(async (resolve, reject) => {
    try {
      const xProxyBaseURL = `http://${proxy.match(/(192\.168\.1\.\d+)/)[0]}`;
      const response = await request(`${xProxyBaseURL}/status?proxy=${proxy}`);

      const responseJson = await response.body.json();
      if (responseJson.status) {
        resolve(responseJson.public_ip);
      } else {
        reject(`${proxy}: ${responseJson.msg}`);
      }
    } catch (err) {
      reject(`${proxy}: ${responseJson.msg}`);
    }
  });
}

// Rotate Proxy
async function rotateXProxy(proxy) {
  return new Promise(async (resolve, reject) => {
    try {
      const xProxyBaseURL = `http://${proxy.match(/(192\.168\.1\.\d+)/)[0]}`;
      const response = await request(`${xProxyBaseURL}/reset?proxy=${proxy}`);

      const responseJson = await response.body.json();
      if (responseJson.status) {
        resolve();
      } else {
        reject(`${proxy}: ${responseJson.msg}`);
      }
    } catch (err) {
      reject(`${proxy}: ${responseJson.msg}`);
    }
  });
}

module.exports = {
  getXProxyIP,
  rotateXProxy,
};
