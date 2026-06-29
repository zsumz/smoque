import { smoke } from "smoque";

smoke.suite("legacy smoke script", async (t) => {
  await t.step("run existing browser smoke", async () => {
    await t.cmd("node", ["scripts/browser-smoke.mjs"], {
      cwd: t.repoRoot(),
      timeout: "60s",
    });
  });
});

// Migration path:
// 1. Wrap legacy scripts as a single step.
// 2. Split the script into steps.
// 3. Replace custom spawn/temp/cleanup helpers with smoque primitives.
// 4. Extract reusable recipes only after the flow stabilizes.
