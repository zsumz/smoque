import { smoke } from "smoque";

smoke.suite("runnable process group example", async (t) => {
  const work = await t.tempDir("process-group-example");
  const appPath = work.path("app.mjs");
  const workerPath = work.path("worker.mjs");

  const port = await t.step("reserve app port", async () => {
    return await t.ports.reserve("app");
  });
  const appUrl = port.url();

  await t.step("create app and worker", async () => {
    await t.fs.writeText(
      appPath,
      `import { createServer } from "node:http";

const port = Number(process.env.PORT);
const server = createServer((request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.url === "/health") {
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(\`app ready on \${port}\`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
`,
    );
    await t.fs.writeText(
      workerPath,
      `const appUrl = process.env.APP_URL;
const response = await fetch(\`\${appUrl}/health\`);
const body = await response.json();
if (body.status !== "ok") {
  throw new Error("app is not healthy");
}
console.log("worker ready");
setInterval(() => {}, 1000);
`,
    );
  });

  const stack = t.process.group("demo-stack");

  await t.step("start stack", async () => {
    await stack.start("app", process.execPath, [appPath], {
      env: t.ports.env({ PORT: port }),
      ready: t.log.contains(`app ready on ${port.port}`, { stream: "stdout" }),
      timeout: "10s",
    });
    await stack.start("worker", process.execPath, [workerPath], {
      env: { APP_URL: appUrl },
      ready: t.log.contains("worker ready", { stream: "stdout" }),
      timeout: "10s",
    });
  });

  await t.step("app is reachable", async () => {
    const response = await t.http.get(`${appUrl}/health`);

    response.expectStatus(200).expectJsonPath("$.status").toBe("ok");
  });

  await t.step("stop stack", async () => {
    await stack.stop();
  });
});
