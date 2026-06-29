import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { expect, smoke } from "smoque";

smoke.suite("runnable release artifact example", async (t) => {
  const work = await t.tempDir("release-artifact");
  const cli = work.path("demo-cli.js");

  await t.step("create local CLI artifact", async () => {
    await t.fs.writeText(
      cli,
      "#!/usr/bin/env node\nconsole.log('demo-cli 1.0.0');\n",
    );
    await t.cmd(process.execPath, [
      "-e",
      "require('node:fs').chmodSync(process.argv[1], 0o755)",
      cli,
    ]);
  });

  await t.step("artifact is executable", async () => {
    await expect.file(cli).toBeExecutable({ args: ["--version"] });
  });

  await t.step("artifact checksum matches", async () => {
    const checksum = createHash("sha256").update(await readFile(cli)).digest("hex");
    await expect.file(cli).toHaveChecksum("sha256", checksum);
  });
});
