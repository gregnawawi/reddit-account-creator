const { request } = require("undici");

async function main() {
  const { statusCode, headers, trailers, body } = await request(
    "https://www.reddit.com/user/"
  );
  body.setEncoding("utf8");
  let content = "";
  for await (const data of body) {
    content += data;
  }
  if (content.includes("page not found")) {
    console.log("this account died");
  } else {
    console.log("this account lives");
    console.log(content);
  }
  // console.log(content);
}

main();
