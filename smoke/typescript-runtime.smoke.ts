import { expect, smoke, type SmokeContext } from "smoque";

smoke.suite("TypeScript smoke files run without a build step", async (t: SmokeContext) => {
  await t.step("execute typed smoke code", async () => {
    const message: string = "native TypeScript smoke";

    expect.value(message).toContain("TypeScript");
  });
});
