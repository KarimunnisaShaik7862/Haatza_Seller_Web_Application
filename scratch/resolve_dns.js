const dns = require('dns');
const axios = require('axios');

function resolve(host) {
  return new Promise((r) => {
    dns.resolve(host, (err, addresses) => {
      if (err) {
        r(`Failed to resolve ${host}: ${err.message}`);
      } else {
        r(`Resolved ${host} to: ${JSON.stringify(addresses)}`);
      }
    });
  });
}

async function testHttp(url) {
  try {
    const res = await axios.get(url, { timeout: 3000 });
    return `GET ${url} Status: ${res.status}`;
  } catch (err) {
    return `GET ${url} Error: ${err.message}`;
  }
}

async function run() {
  console.log(await resolve('haatzaseller.com'));
  console.log(await resolve('www.haatzaseller.com'));
  console.log(await resolve('haatza.com'));
  console.log(await resolve('www.haatza.com'));

  console.log(await testHttp('https://www.haatza.com/_functions/checkseller?phone=9392250392'));
  console.log(await testHttp('https://haatza.com/_functions/checkseller?phone=9392250392'));
}

run();
