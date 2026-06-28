import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "vitest";

import { createJsonReporter, resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../../dist/core.js";
import { formatCapturedRequests } from "../../../../dist/plugins/http/fake-request-expectations.js";
import httpPlugin from "../../../../dist/plugins/http.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("http plugin performs requests and JSON assertions", async () => {
  const received = [];
  const server = createServer(async (request, response) => {
    if (request.url === "/health") {
      response.setHeader("content-type", "application/json");
      response.setHeader("x-smoke-service", "users");
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (request.url === "/users" && request.method === "POST") {
      const body = await readBody(request);
      received.push(JSON.parse(body));
      response.statusCode = 201;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: "user_1" }));
      return;
    }

    response.statusCode = 404;
    response.end("missing");
  });

  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  smoke.use(httpPlugin());
  smoke.suite("http requests", async (t) => {
    const health = await t.http.get(`${baseUrl}/health`);
    health
      .expectStatus(200)
      .expectHeader("content-type")
      .matching(/application\/json/u)
      .expectHeader("x-smoke-service")
      .toBe("users")
      .expectJsonPath("$.status")
      .toBe("ok");

    const created = await t.http.post(`${baseUrl}/users`, {
      json: { email: "smoke@example.com" },
    });
    created.expectStatus(201).expectJsonPath("$.id").toExist();
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, "passed");
    assert.deepEqual(received, [{ email: "smoke@example.com" }]);
  } finally {
    await close(server);
  }
});

test("http.fakeServer serves routes and captures requests", async () => {
  smoke.use(httpPlugin());
  smoke.suite("fake server", async (t) => {
    const fake = await t.http.fakeServer("webhook-provider");

    fake.post("/events").reply(202, { accepted: true });
    fake.patch("/events").reply(200, { updated: true }, { "x-fake-service": "webhook" });

    const response = await t.http.post(fake.url("/events?debug=1"), {
      json: { type: "smoke.event", data: { id: "evt_1" } },
      headers: { "x-smoke-test": "yes" },
    });

    response.expectStatus(202).expectJsonPath("$.accepted").toBe(true);

    assert.deepEqual(
      fake.requests().map((request) => request.path),
      ["/events"],
    );
    fake
      .expectRequest("POST", "/events")
      .withHeader("content-type")
      .matching(/application\/json/u)
      .withHeader("x-smoke-test")
      .toBe("yes")
      .withJsonPath("$.type")
      .toBe("smoke.event")
      .withJsonPath("$.data.id")
      .toExist();

    const updated = await t.http.patch(fake.url("/events"), {
      json: { type: "smoke.updated" },
    });

    updated
      .expectStatus(200)
      .expectHeader("x-fake-service")
      .toBe("webhook")
      .expectJsonPath("$.updated")
      .toBe(true);
    fake.expectRequest("PATCH", "/events").withJsonPath("$.type").toBe("smoke.updated");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});

test("http.fakeServer serves supported response body shapes", async () => {
  smoke.use(httpPlugin());
  smoke.suite("fake server response shapes", async (t) => {
    const fake = await t.http.fakeServer("response-shapes");

    fake.get("empty").reply(204);
    fake.get("/text").reply(200, "hello text");
    fake.get("/bytes").reply(200, new Uint8Array([115, 109, 111, 113]));
    fake.get("/json").reply(200, { ok: true });
    fake.get("/custom-json").reply(200, { ok: true }, { "content-type": "application/vnd.smoque+json" });

    const empty = await t.http.get(fake.url("empty?debug=1"));
    empty.expectStatus(204);
    assert.equal(empty.body, "");

    const text = await t.http.get(fake.url("/text"));
    text.expectStatus(200).expectHeader("content-type").toBe("text/plain; charset=utf-8");
    assert.equal(text.body, "hello text");

    const bytes = await t.http.get(fake.url("/bytes"));
    bytes.expectStatus(200);
    assert.equal(bytes.body, "smoq");

    const json = await t.http.get(fake.url("/json"));
    json
      .expectStatus(200)
      .expectHeader("content-type")
      .toBe("application/json; charset=utf-8")
      .expectJsonPath("$.ok")
      .toBe(true);

    const customJson = await t.http.get(fake.url("/custom-json"));
    customJson
      .expectStatus(200)
      .expectHeader("content-type")
      .toBe("application/vnd.smoque+json")
      .expectJsonPath("$.ok")
      .toBe(true);
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});

test("http network policy blocks external requests with redaction", async () => {
  smoke.use(httpPlugin());
  smoke.suite("blocked network", async (t) => {
    t.redact("api.example.test");
    t.net.policy({ external: "block" });

    await t.http.get("https://api.example.test/private?token=secret");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "failed");
  assert.match(result.suites[0].error.message, /Blocked external network request: GET \[redacted\]\/private/u);
  assert.equal(result.suites[0].error.details.method, "GET");
  assert.equal(result.suites[0].error.details.host, "[redacted]");
  assert.equal(result.suites[0].error.details.path, "/private");
});

test("http network policy allows fake local servers", async () => {
  smoke.use(httpPlugin());
  smoke.suite("local network", async (t) => {
    t.net.policy({ external: "block" });
    const fake = await t.http.fakeServer("local-provider");

    fake.get("/health").reply(200, { ok: true });

    const response = await t.http.get(fake.url("/health"));
    response.expectStatus(200).expectJsonPath("$.ok").toBe(true);
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});

test("http.fakeServer missing request failures list received requests", async () => {
  const reporter = createJsonReporter({ write() {} });

  smoke.use(httpPlugin());
  smoke.suite("fake server diagnostics", async (t) => {
    const fake = await t.http.fakeServer("diagnostic-webhook");

    fake.post("/actual").reply(202, { accepted: true });

    await t.http.post(fake.url("/actual"), {
      json: { type: "wrong.event", data: { id: "evt_1" } },
      headers: {
        authorization: "Bearer secret-value",
        "x-smoke-test": "diagnostics",
      },
    });

    fake.expectRequest("POST", "/events");
  });

  const result = await runRegisteredSuites({
    repoRoot: process.cwd(),
    eventSink: reporter,
  });
  const message = result.suites[0].error.message;
  const artifact = reporter.report().suites[0].artifacts[0];

  assert.equal(result.status, "failed");
  assert.match(message, /Expected captured request POST \/events, but none was received/u);
  assert.match(message, /Received requests:/u);
  assert.match(message, /1\. POST \/actual/u);
  assert.match(message, /authorization: \[redacted\]/u);
  assert.match(message, /x-smoke-test: diagnostics/u);
  assert.match(message, /"type":"wrong\.event"/u);
  assert.doesNotMatch(message, /secret-value/u);
  assert.equal(artifact.name, "diagnostic-webhook-requests.txt");
  assert.match(await readFile(artifact.path, "utf8"), /POST \/actual/u);
});

test("http.fakeServer request expectation failures include captured context", async () => {
  for (const scenario of [
    {
      run: (expectation) => expectation.withHeader("x-missing"),
      message: /Expected request header x-missing to exist\./u,
    },
    {
      run: (expectation) => expectation.withHeader("x-smoke-test").toBe("expected"),
      message: /Expected request header x-smoke-test to be "expected", got "actual"\./u,
    },
    {
      run: (expectation) => expectation.withHeader("x-smoke-test").matching(/^expected$/u),
      message: /Expected request header x-smoke-test to match \/\^expected\$\/u, got "actual"\./u,
    },
    {
      run: (expectation) => expectation.withJsonPath("$.missing").toExist(),
      message: /Expected captured request JSON path \$\.missing to exist\./u,
    },
    {
      run: (expectation) => expectation.withJsonPath("$.type").toBe("expected.event"),
      message: /Expected captured request JSON path \$\.type to be "expected\.event", got "actual\.event"\./u,
    },
  ]) {
    const result = await runFakeRequestExpectationFailure(scenario.run);
    const message = result.suites[0].error.message;

    assert.equal(result.status, "failed");
    assert.match(message, scenario.message);
    assert.match(message, /Captured request:/u);
    assert.match(message, /POST \/events/u);
    assert.match(message, /x-smoke-test: actual/u);
    assert.match(message, /"type":"actual\.event"/u);
  }
});

test("http.fakeServer formats captured requests for empty and large diagnostics", () => {
  assert.equal(formatCapturedRequests([]), "  (none)");

  const output = formatCapturedRequests([
    {
      method: "POST",
      path: "/events",
      headers: {
        "aa-long": "h".repeat(130),
        authorization: "Bearer secret",
        "header-01": "1",
        "header-02": "2",
        "header-03": "3",
        "header-04": "4",
        "header-05": "5",
        "header-06": "6",
        "header-07": "7",
        "header-08": "8",
        "header-09": "9",
        "header-10": "10",
        "header-11": "11",
      },
      body: "",
      json: undefined,
    },
    {
      method: "PUT",
      path: "/large",
      headers: {},
      body: "x".repeat(520),
      json: undefined,
    },
  ]);

  assert.match(output, /1\. POST \/events/u);
  assert.ok(output.includes(`aa-long: ${"h".repeat(120)}...`));
  assert.match(output, /authorization: \[redacted\]/u);
  assert.match(output, /header-10: 10/u);
  assert.doesNotMatch(output, /header-11/u);
  assert.doesNotMatch(output, /secret/u);
  assert.match(output, /body: \(empty\)/u);
  assert.match(output, /2\. PUT \/large/u);
  assert.ok(output.includes(`body: ${"x".repeat(500)}...`));
});

test("http response header assertions fail clearly", async () => {
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "text/plain");
    response.end("ok");
  });

  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  smoke.use(httpPlugin());
  smoke.suite("response headers", async (t) => {
    const response = await t.http.get(`${baseUrl}/health`);
    response.expectHeader("x-missing").toExist();
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, "failed");
    assert.match(result.suites[0].error.message, /Expected response header x-missing to exist/u);
  } finally {
    await close(server);
  }
});

test("http response assertion failures attach redacted transcripts", async () => {
  const secret = "response-secret-123";
  const reporter = createJsonReporter({ write() {} });
  const server = createServer((_request, response) => {
    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.setHeader("x-debug-token", secret);
    response.end(JSON.stringify({ error: secret }));
  });

  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  smoke.use(httpPlugin());
  smoke.suite("http transcript", async (t) => {
    t.redact(secret);
    const response = await t.http.get(`${baseUrl}/health`, {
      headers: {
        authorization: `Bearer ${secret}`,
      },
    });
    response.expectStatus(200);
  });

  try {
    const result = await runRegisteredSuites({
      repoRoot: process.cwd(),
      eventSink: reporter,
    });
    const report = reporter.report();
    const artifact = report.suites[0].artifacts[0];

    assert.equal(result.status, "failed");
    assert.equal(artifact.name, `http-GET-127.0.0.1-health.transcript.txt`);
    assert.equal(artifact.kind, "text");

    const transcript = await readFile(artifact.path, "utf8");
    assert.match(transcript, /GET http:\/\/127\.0\.0\.1:\d+\/health/u);
    assert.match(transcript, /Response status: 500/u);
    assert.match(transcript, /authorization: \[redacted\]/u);
    assert.match(transcript, /x-debug-token: \[redacted\]/u);
    assert.doesNotMatch(transcript, new RegExp(secret, "u"));
  } finally {
    await close(server);
  }
});

test("http.fakeServer reports missing routes and closes during cleanup", async () => {
  let fake;

  smoke.use(httpPlugin());
  smoke.suite("fake server cleanup", async (t) => {
    fake = await t.http.fakeServer("missing-route");

    const response = await t.http.get(fake.url("/missing"));

    response.expectStatus(404);
    assert.match(response.body, /No fake HTTP route for GET \/missing/u);
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
  assert.ok(fake);
  await assert.rejects(() => fetch(fake.url("/missing")));
});

test("http.ready works as a process readiness probe", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-http-ready-"));
  const serverFile = join(root, "server.cjs");
  const port = await getFreePort();

  await writeFile(
    serverFile,
    `
      const http = require("node:http");
      const server = http.createServer((_req, res) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ status: "ok" }));
      });
      server.listen(process.env.PORT, "127.0.0.1");
    `,
    "utf8",
  );

  smoke.use(httpPlugin());
  smoke.suite("http ready process", async (t) => {
    const app = await t.process.start(process.execPath, [serverFile], {
      env: { PORT: String(port) },
      ready: t.http.ready(`http://127.0.0.1:${port}/health`, { timeout: "200ms" }),
      timeout: "2s",
    });

    const response = await t.http.get(`http://127.0.0.1:${port}/health`);
    response.expectStatus(200).expectJsonPath("$.status").toBe("ok");

    await app.stop();
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("http.ready reports not-ready status messages", async () => {
  const server = createServer((_request, response) => {
    response.statusCode = 503;
    response.end("booting");
  });

  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  smoke.use(httpPlugin());
  smoke.suite("http not ready", async (t) => {
    await t.poll(
      "http ready",
      async () => {
        const result = await t.http.ready(`${baseUrl}/health`, { timeout: "100ms" }).check();
        if (!result.ready) {
          throw new Error(result.message);
        }
      },
      { timeout: "30ms", interval: "5ms" },
    );
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, "failed");
    assert.equal(result.suites[0].error.name, "ProbeTimeoutError");
    assert.equal(result.suites[0].error.details.lastError.message, "status 503");
  } finally {
    await close(server);
  }
});

test("http.ready reports network failures as not ready", async () => {
  const port = await getFreePort();

  smoke.use(httpPlugin());
  smoke.suite("http ready network failure", async (t) => {
    const result = await t.http.ready(`http://127.0.0.1:${port}/health`, { timeout: "50ms" }).check();

    assert.equal(result.ready, false);
    assert.match(result.message, /fetch failed|ECONNREFUSED|connect/u);
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});

test("http.ready succeeds after retrying a not-ready response", async () => {
  let attempts = 0;
  const server = createServer((_request, response) => {
    attempts += 1;
    if (attempts === 1) {
      response.statusCode = 503;
      response.end("booting");
      return;
    }

    response.end("ok");
  });

  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  smoke.use(httpPlugin());
  smoke.suite("http ready retry", async (t) => {
    await t.poll(
      "http ready",
      async () => {
        const result = await t.http.ready(`${baseUrl}/health`, { timeout: "100ms" }).check();
        if (!result.ready) {
          throw new Error(result.message);
        }
      },
      { timeout: "200ms", interval: "5ms" },
    );
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: process.cwd() });

    assert.equal(result.status, "passed");
    assert.equal(attempts, 2);
  } finally {
    await close(server);
  }
});

test("http plugin supports local CA certificates for HTTPS requests and readiness", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-http-tls-ca-"));
  const certificate = await generateLocalCertificate(root);
  const server = createHttpsServer({
    key: await readFile(certificate.keyPath),
    cert: await readFile(certificate.certPath),
  }, (_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ status: "ok" }));
  });

  await listen(server);
  const baseUrl = `https://127.0.0.1:${server.address().port}`;

  smoke.use(httpPlugin());
  smoke.suite("https local CA", async (t) => {
    t.net.policy({ external: "block" });

    const ready = await t.http.ready(`${baseUrl}/health`, {
      tls: { ca: certificate.certPath },
      timeout: "200ms",
    }).check();
    assert.deepEqual(ready, { ready: true, message: "status 200" });

    const response = await t.http.get(`${baseUrl}/health`, {
      tls: { ca: certificate.certPath },
    });
    response.expectStatus(200).expectJsonPath("$.status").toBe("ok");
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
  } finally {
    await close(server);
    await rm(root, { recursive: true, force: true });
  }
});

test("http plugin supports explicit local self-signed HTTPS mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-http-tls-self-signed-"));
  const certificate = await generateLocalCertificate(root);
  const server = createHttpsServer({
    key: await readFile(certificate.keyPath),
    cert: await readFile(certificate.certPath),
  }, (_request, response) => {
    response.end("ok");
  });

  await listen(server);
  const baseUrl = `https://127.0.0.1:${server.address().port}`;

  smoke.use(httpPlugin());
  smoke.suite("https self signed", async (t) => {
    const response = await t.http.get(`${baseUrl}/health`, {
      tls: { selfSigned: true },
    });

    response.expectStatus(200);
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });

    assert.equal(result.status, "passed");
  } finally {
    await close(server);
    await rm(root, { recursive: true, force: true });
  }
});

test("http plugin reports TLS verification failures separately from response failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-http-tls-failure-"));
  const certificate = await generateLocalCertificate(root);
  const server = createHttpsServer({
    key: await readFile(certificate.keyPath),
    cert: await readFile(certificate.certPath),
  }, (_request, response) => {
    response.end("ok");
  });

  await listen(server);
  const baseUrl = `https://127.0.0.1:${server.address().port}`;

  smoke.use(httpPlugin());
  smoke.suite("https tls failure", async (t) => {
    await t.http.get(`${baseUrl}/health`, {
      tls: {},
    });
  });

  try {
    const result = await runRegisteredSuites({ repoRoot: root });
    const error = result.suites[0].error;

    assert.equal(result.status, "failed");
    assert.equal(error.name, "SmokeError");
    assert.match(error.message, /TLS verification failed/u);
    assert.equal(error.details.kind, "tls");
    assert.equal(error.details.method, "GET");
    assert.match(error.details.code, /SELF_SIGNED|VERIFY|SIGNATURE/u);
  } finally {
    await close(server);
    await rm(root, { recursive: true, force: true });
  }
});

test("http TLS options still honor external network policy", async () => {
  smoke.use(httpPlugin());
  smoke.suite("https tls network policy", async (t) => {
    t.net.policy({ external: "block" });

    await t.http.get("https://api.example.test/health", {
      tls: { selfSigned: true },
    });
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "failed");
  assert.match(result.suites[0].error.message, /Blocked external network request/u);
});

async function runFakeRequestExpectationFailure(run) {
  resetSmokeRegistry();
  smoke.use(httpPlugin());
  smoke.suite("fake server expectation failure", async (t) => {
    const fake = await t.http.fakeServer("request-expectation-failure");

    fake.post("events").reply(202);

    await t.http.post(fake.url("events?debug=1"), {
      json: { type: "actual.event", data: { id: "evt_1" } },
      headers: { "x-smoke-test": "actual" },
    });

    run(fake.expectRequest("post", "events"));
  });

  return runRegisteredSuites({ repoRoot: process.cwd() });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

async function getFreePort() {
  const server = createServer();
  await listen(server);
  const { port } = server.address();
  await close(server);
  return port;
}

async function generateLocalCertificate(root) {
  const keyPath = join(root, "local.key");
  const certPath = join(root, "local.crt");
  const result = spawnSync("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    keyPath,
    "-out",
    certPath,
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`openssl failed: ${result.error?.message || result.stderr || result.stdout}`);
  }

  return { keyPath, certPath };
}
