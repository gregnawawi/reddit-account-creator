// Format date time (string)
// Ex: formatDate(new Date(), "mm-dd-yy");
function formatDate(date, format) {
  const map = {
    mm: date.getMonth() + 1,
    dd: date.getDate(),
    yy: date.getFullYear().toString().slice(-2),
    YYYY: date.getFullYear(),
  };

  return format.replace(/mm|dd|yy|YYYY/g, (matched) => map[matched]);
}

module.exports = {
  formatDate,
};
