import { smoke } from "smoque";

smoke.suite("fake HTTP server captures outbound requests", async (t) => {
  const fake = await t.step("start fake webhook server", async () => {
    return await t.http.fakeServer("webhook-provider");
  });

  await t.step("register webhook route", async () => {
    fake.post("/events").reply(202, { accepted: true }, { "x-webhook-provider": "fake" });
  });

  await t.step("send webhook request", async () => {
    const response = await t.http.post(fake.url("/events?debug=1"), {
      json: { type: "smoke.event", data: { id: "evt_dogfood" } },
      headers: { "x-smoke-test": "dogfood" },
    });

    response
      .expectStatus(202)
      .expectHeader("x-webhook-provider")
      .toBe("fake")
      .expectJsonPath("$.accepted")
      .toBe(true);
  });

  await t.step("captured webhook request has expected shape", async () => {
    await fake
      .expectRequest("POST", "/events")
      .withHeader("content-type")
      .matching(/application\/json/u)
      .withHeader("x-smoke-test")
      .toBe("dogfood")
      .withJsonPath("$.type")
      .toBe("smoke.event")
      .withJsonPath("$.data.id")
      .toBe("evt_dogfood");
  });
});
