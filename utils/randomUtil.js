// Return a random integer between min & max (included)
function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Return random (string)
function randomString(length) {
  const CHARACTERS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARACTERS.charAt(randint(0, CHARACTERS.length));
  }
  return result;
}

// Return a random element of an array
function choice(array) {
  return array[randint(0, array.length - 1)];
}

// Return random username (string)
// Ex: jessica_6969
// Format: [firstName]_[xxxx]
function randomUsername(firstNameList) {
  // Get a random firstname & Normalize it
  const randomFirstname = choice(firstNameList).toLowerCase().trim();

  // Get a random number between (30 - 10000)
  const randomNumber = randint(30, 10000);

  return `${randomFirstname}_${randomNumber}`;
}

module.exports = {
  randint,
  randomString,
  randomUsername,
  choice,
};
