const mongoose = require("mongoose");
const { request } = require("undici");

const tinsoftSchema = new mongoose.Schema({
  proxy: String,
  APIKey: String,
  using: {
    type: Number,
    default: 0,
  },
  used: {
    type: Number,
    default: 0,
  },
  rotating: {
    type: Boolean,
    default: false,
  },
  status: {
    type: Boolean,
    default: true,
  },
});

// Update to the latest document
tinsoftSchema.methods.update = async function () {
  const latestTinsoft = await this.model("Tinsoft").findOne({ _id: this._id });

  for (const key of Object.keys(this)) {
    this[key] = latestTinsoft[key];
  }
};

// New process start using proxy
tinsoftSchema.methods.startUsing = async function () {
  return new Promise(async (resolve, reject) => {
    if (this.rotating) {
      reject(`${this.APIKey} -> can't be used now, wait to finish rotating.`);
    } else {
      const latestTinsoft = await this.model("Tinsoft").findOneAndUpdate(
        { _id: this._id },
        { $inc: { using: 1, used: 1 } },
        { new: true }
      );
      for (const key of Object.keys(this)) {
        this[key] = latestTinsoft[key];
      }

      resolve();
    }
  });
};

// A Process ends using proxy
tinsoftSchema.methods.endUsing = async function () {
  return new Promise(async (resolve, reject) => {
    try {
      await this.model("Tinsoft").updateOne(
        { _id: this._id },
        { $inc: { using: -1 } }
      );
      resolve();
    } catch (err) {
      reject(`${this.APIKey} -> can't end using, ${err}`);
    }
  });
};

// Get a new Tinsoft IP
tinsoftSchema.methods.rotate = async function () {
  return new Promise(async (resolve, reject) => {
    try {
      if (this.rotating) {
        reject(`${this.proxy}: is rotating`);
        return;
      }
      if (this.using > 0) {
        reject(`${this.APIKey} -> can't rotate, another process is using`);
      } else {
        this.rotating = true;
        await this.save();

        // Get a new IP Address
        const response = await request(
          `http://proxy.tinsoftsv.com/api/changeProxy.php?key=${this.APIKey}&location=0`
        );

        const responseJson = await response.body.json();

        if (responseJson.success == "true") {
          this.proxy = responseJson.proxy;
        } else {
          reject(`${this.APIKey} -> ${responseJson.description}`);
          return;
        }
        await this.save();

        // Finish rotating, update fields
        this.rotating = false;
        this.used = 1;
        await this.save();
        resolve();
      }
    } catch (err) {
      this.rotating = false;
      await this.save();
      reject(`${this.APIKey} -> can't rotate, ${err}`);
    }
  });
};

// Get current IP
tinsoftSchema.methods.getCurrentIP = async function () {
  return new Promise(async (resolve, reject) => {
    try {
      // Get a new IP Address
      const response = await request(
        `http://proxy.tinsoftsv.com/api/getProxy.php?key=${this.APIKey}`
      );

      const responseJson = await response.body.json();

      if (responseJson.success == "true") {
        return responseJson.proxy.split(":")[0];
      } else {
        reject(responseJson.description);
        return;
      }
    } catch (err) {
      reject(`${this.APIKey} -> can't get currentIP ${err}`);
    }
  });
};

// Rotate if needed
tinsoftSchema.methods.rotateIfNeeded = async function (options) {
  const { workerId, numProcesses } = options;
  return new Promise(async (resolve, reject) => {
    try {
      // Calculate maxUsed
      const numProxies = await this.model("Tinsoft").countDocuments({
        status: true,
      });
      const tempA = Math.ceil((1 - workerId) / numProxies);
      const tempB = Math.floor((numProcesses - workerId) / numProxies);
      const maxUsed = tempB - tempA + 1;

      // Rotate proxy if it reaches maxUsed
      if (this.used == maxUsed) {
        await this.rotate();
      }
      resolve();
    } catch (err) {
      reject(`${this.APIKey}: can't rotateIfNeeded, ${err}`);
    }
  });
};

// Get proxy by workerId, return null if proxies are empty
tinsoftSchema.statics.getProxyByWorkerId = async function (workerId) {
  return new Promise(async (resolve, reject) => {
    try {
      const numProxies = await this.countDocuments({ status: true });

      if (numProxies === 0) return null;

      let proxies = await this.find().sort();
      let proxyIndex = workerId % numProxies;
      if (proxyIndex != 0) {
        proxyIndex -= 1;
      } else {
        proxyIndex = proxies.length - 1;
      }
      resolve(proxies[proxyIndex]);
    } catch (err) {
      reject(`can't get proxyByWorkerId=${workerId}`);
    }
  });
};

const Tinsoft = mongoose.model("Tinsoft", tinsoftSchema);

module.exports = {
  Tinsoft,
  tinsoftSchema,
};
