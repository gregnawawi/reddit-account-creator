const { request } = require("undici");

async function main() {
  const { statusCode, headers, trailers, body } = await request(
    "https://old.reddit.com/user/elisa_1306"
  );
  console.log("response received", statusCode);
  console.log("headers", headers);

  for await (const data of body) {
    console.log("data", data);
  }

  console.log("trailers", trailers);
}

main();
