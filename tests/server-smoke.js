const assert = require("assert");
const http = require("http");
const { app, mockDefine, mockSimplify, normalizeText } = require("../server/index");

async function request(server, path, options = {}) {
  const address = server.address();

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: address.port,
      path,
      method: options.method || "GET",
      headers: options.headers || {}
    }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  assert.strictEqual(normalizeText("  one\n\n two  "), "one two");
  assert.throws(() => normalizeText("   "), /non-empty text/);
  assert.strictEqual(mockSimplify("One. Two. Three. Four."), "One. Two. Three.");
  assert.match(mockDefine("photosynthesis"), /photosynthesis means/);

  const server = app.listen(0);
  try {
    const health = await request(server, "/health");
    assert.strictEqual(health.status, 200);
    const healthBody = JSON.parse(health.body);
    assert.strictEqual(healthBody.ok, true);
    assert.strictEqual(healthBody.mode, "mock");
    assert.strictEqual(typeof healthBody.geminiConfigured, "boolean");
    assert.strictEqual(typeof healthBody.groqConfigured, "boolean");

    const allowed = await request(server, "/health", {
      headers: { Origin: "chrome-extension://abc123" }
    });
    assert.strictEqual(allowed.status, 200);
    assert.strictEqual(allowed.headers["access-control-allow-origin"], "chrome-extension://abc123");

    const blocked = await request(server, "/health", {
      headers: { Origin: "https://example.com" }
    });
    assert.strictEqual(blocked.status, 403);

    const simplified = await request(server, "/simplify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "This is a complicated sentence. This is another sentence." })
    });
    assert.strictEqual(simplified.status, 200);
    assert.strictEqual(JSON.parse(simplified.body).mocked, true);

    const defined = await request(server, "/define", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: "metaphor" })
    });
    assert.strictEqual(defined.status, 200);
    assert.strictEqual(JSON.parse(defined.body).mocked, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
