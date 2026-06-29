import { smoke, expect } from "smoque";

smoke.suite("http service starts", async (t) => {
  const root = t.repoRoot();
  const port = await t.step("reserve service port", async () => {
    return await t.ports.reserve("service");
  });
  const baseUrl = port.url();

  const app = await t.step("start service", async () => {
    return await t.process.start("npm", ["run", "dev"], {
      cwd: root,
      env: t.ports.env({ PORT: port }),
      ready: t.http.ready(`${baseUrl}/health`),
      timeout: "20s",
    });
  });

  await t.step("health endpoint returns ok", async () => {
    await t.http
      .get(`${baseUrl}/health`)
      .expectStatus(200)
      .expectJsonPath("$.status")
      .toBe("ok");
  });

  await t.step("core endpoint accepts one resource", async () => {
    await t.http
      .post(`${baseUrl}/users`, {
        json: { email: "smoke@example.com" },
      })
      .expectStatus(201)
      .expectJsonPath("$.id")
      .toExist();
  });

  await app.stop();
});
