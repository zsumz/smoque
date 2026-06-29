import { smoke } from "smoque";

smoke.suite("runnable fake webhook example", async (t) => {
  const fake = await t.step("start fake webhook receiver", async () => {
    return await t.http.fakeServer("runnable-webhook-receiver");
  });

  await t.step("register webhook route", async () => {
    fake.post("/events").reply(202, { accepted: true }, { "x-webhook-id": "evt_fake" });
  });

  await t.step("send webhook to fake service", async () => {
    const response = await t.http.post(fake.url("/events"), {
      json: { type: "smoke.event", data: { id: "evt_runnable" } },
      headers: { "x-smoke-test": "examples" },
    });

    response
      .expectStatus(202)
      .expectHeader("x-webhook-id")
      .toBe("evt_fake")
      .expectJsonPath("$.accepted")
      .toBe(true);
  });

  await t.step("captured request has expected shape", async () => {
    await fake
      .expectRequest("POST", "/events")
      .withHeader("x-smoke-test")
      .toBe("examples")
      .withJsonPath("$.type")
      .toBe("smoke.event")
      .withJsonPath("$.data.id")
      .toBe("evt_runnable");
  });
});
