import { expect, smoke } from "smoque";

smoke.suite("runnable CLI example", async (t) => {
  const work = await t.tempDir("runnable-cli-example");
  const cliPath = work.path("demo-cli.mjs");

  await t.step("create demo CLI", async () => {
    await t.fs.writeText(
      cliPath,
      `const [command, ...args] = process.argv.slice(2);

if (command === undefined || command === "--help") {
  console.log("Usage: demo-cli <echo|version|fail>");
  process.exit(0);
}

if (command === "echo") {
  console.log(args.join(" "));
  process.exit(0);
}

if (command === "version") {
  console.log("1.2.3");
  process.exit(0);
}

if (command === "config") {
  console.log(JSON.stringify({ name: "demo-cli", features: { echo: true } }));
  process.exit(0);
}

if (command === "fail") {
  console.error("intentional failure");
  process.exit(2);
}

console.error(\`Unknown command: \${command}\`);
process.exit(2);
`,
    );
  });

  await t.step("help works", async () => {
    const result = await t.cmd(process.execPath, [cliPath, "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });

  await t.step("command returns expected output", async () => {
    const result = await t.cmd(process.execPath, [cliPath, "echo", "hello", "smoke"]);

    expect(result.stdout.trim()).toBe("hello smoke");
  });

  await t.step("json output has expected shape", async () => {
    const result = await t.cmd(process.execPath, [cliPath, "config"]);

    await expect.command(result).stdoutJsonPath("$.name").toBe("demo-cli");
    await expect.command(result).stdoutJsonPath("$.features.echo").toBe(true);
  });

  await t.step("json config file has expected shape", async () => {
    const configPath = work.path("config.json");

    await t.fs.writeJson(configPath, { package: { name: "demo-cli", bin: "demo" } });
    await expect.file(configPath).jsonPath("$.package.name").toBe("demo-cli");
    await expect.file(configPath).jsonPath("$.package.bin").toExist();
  });

  await t.step("expected failures are explicit", async () => {
    const result = await t.cmd(process.execPath, [cliPath, "fail"], { check: false });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("intentional failure");
  });
});
