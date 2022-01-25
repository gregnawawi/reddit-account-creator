const fs = require("fs");

// Turn .txt file into array
function txtToArray(filePath) {
  return fs.readFileSync(filePath).toString().split("\n");
}

module.exports = {
  txtToArray,
};
