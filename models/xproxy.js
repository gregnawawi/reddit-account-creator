const mongoose = require("mongoose");
const { getXProxyIP, rotateXProxy } = require("../utils/xproxyUtil");

const xProxySchema = new mongoose.Schema({
  proxy: String,
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
xProxySchema.methods.update = async function () {
  const latestXProxy = await this.model("xProxy").findOne({ _id: this._id });

  for (const key of Object.keys(this)) {
    this[key] = latestXProxy[key];
  }
};

// New process start using proxy
xProxySchema.methods.startUsing = async function () {
  return new Promise(async (resolve, reject) => {
    const latestXProxy = await this.model("xProxy").findOneAndUpdate(
      { _id: this._id },
      { $inc: { using: 1, used: 1 } },
      { new: true }
    );

    for (const key of Object.keys(this)) {
      this[key] = latestXProxy[key];
    }

    if (this.rotating) {
      reject(`${this.proxy} -> can't be used now, wait to finish rotating.`);
    } else {
      resolve();
    }
  });
};

// A Process ends using proxy
xProxySchema.methods.endUsing = async function () {
  return new Promise(async (resolve, reject) => {
    try {
      await this.model("xProxy").updateOne(
        { _id: this._id },
        { $inc: { using: -1 } }
      );
      resolve();
    } catch (err) {
      reject(`${this.proxy} -> can't end using, ${err}`);
    }
  });
};

// Rotate proxy
xProxySchema.methods.rotate = async function () {
  return new Promise(async (resolve, reject) => {
    try {
      if (this.using > 1) {
        reject(`${this.proxy} -> can't rotate, another process is using`);
      } else {
        this.rotating = true;
        await this.save();

        await rotateXProxy(this.proxy);

        // Finish rotating, update fields
        this.rotating = false;
        this.used = 1;
        await this.save();
        resolve();
      }
    } catch (err) {
      this.rotating = false;
      this.using -= 1;
      await this.save();
      reject(`${this.proxy} -> can't rotate, ${err}`);
    }
  });
};

// Get current IP
xProxySchema.methods.getCurrentIP = async function () {
  return new Promise(async (resolve, reject) => {
    try {
      resolve(await getXProxyIP(this.proxy));
    } catch (err) {
      reject(`${this.proxy} -> can't get currentIP ${err}`);
    }
  });
};

// Rotate if needed
xProxySchema.methods.rotateIfNeeded = async function (options) {
  const { workerId, numProcesses } = options;
  return new Promise(async (resolve, reject) => {
    try {
      // Calculate maxUsed
      const numProxies = await this.model("xProxy").countDocuments({
        status: true,
      });
      const tempA = Math.ceil((1 - workerId) / numProxies);
      const tempB = Math.floor((numProcesses - workerId) / numProxies);
      const maxUsed = tempB - tempA + 1;

      // Rotate proxy if it reaches maxUsed
      if (this.used > maxUsed) {
        await this.rotate();
      }
      resolve();
    } catch (err) {
      reject(`${this.proxy}: can't rotateIfNeeded, ${err}`);
    }
  });
};

// Get proxy by workerId, return null if proxies are empty
xProxySchema.statics.getProxyByWorkerId = async function (workerId) {
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
      reject(`can't get xroxyByWorkerId=${workerId}`);
    }
  });
};

const xProxy = mongoose.model("xProxy", xProxySchema);

exports.xProxySchema = xProxySchema;
exports.xProxy = xProxy;
