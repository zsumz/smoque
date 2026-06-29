import { smoke } from "smoque";

smoke.suite("runnable HTTP service example", async (t) => {
  const work = await t.tempDir("runnable-http-service-example");
  const servicePath = work.path("service.mjs");

  const port = await t.step("reserve service port", async () => {
    return await t.ports.reserve("service");
  });
  const baseUrl = port.url();

  await t.step("create demo HTTP service", async () => {
    await t.fs.writeText(
      servicePath,
      `import { createServer } from "node:http";

const port = Number(process.env.PORT);
const users = [];

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");

  if (request.method === "GET" && request.url === "/health") {
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (request.method === "POST" && request.url === "/users") {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const user = { id: \`usr_\${users.length + 1}\`, email: body.email };
    users.push(user);

    response.statusCode = 201;
    response.end(JSON.stringify(user));
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(\`ready on \${port}\`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
`,
    );
  });

  const app = await t.step("start demo service", async () => {
    return await t.process.start(process.execPath, [servicePath], {
      env: t.ports.env({ PORT: port }),
      name: "runnable-http-service",
      ready: t.log.contains(`ready on ${port.port}`, { stream: "stdout" }),
      timeout: "10s",
    });
  });

  await t.step("health endpoint returns ok", async () => {
    const response = await t.http.get(`${baseUrl}/health`);

    response.expectStatus(200).expectJsonPath("$.status").toBe("ok");
  });

  await t.step("core endpoint accepts one resource", async () => {
    const response = await t.http.post(`${baseUrl}/users`, {
      json: { email: "smoke@example.com" },
    });

    response.expectStatus(201).expectJsonPath("$.id").toBe("usr_1");
  });

  await t.step("stop demo service", async () => {
    await app.stop();
  });
});
