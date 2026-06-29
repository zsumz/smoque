import { smoke } from "smoque";

smoke.suite("outbound webhook shape", async (t) => {
  const fake = await t.http.fakeServer("webhook-receiver");

  fake.post("/events").reply(202, { accepted: true });

  await t.step("run code that sends webhook", async () => {
    await t.cmd("node", ["scripts/send-webhook.mjs"], {
      env: {
        WEBHOOK_URL: fake.url("/events"),
      },
    });
  });

  await t.step("webhook request was captured", async () => {
    await fake.expectRequest("POST", "/events")
      .withHeader("content-type")
      .matching(/application\/json/u)
      .withJsonPath("$.type")
      .toBe("smoke.event")
      .withJsonPath("$.data.id")
      .toExist();
  });
});
