import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "vitest";
import { cliResultSummary, coreUrl, findFiles, runCli } from "./helpers.js";

test("smoque --version prints the package version", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-version-"));

  try {
    const result = await runCli(["--version"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^0\.1\.0-alpha\.0\n$/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque help commands print lowercase help", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-help-"));

  try {
    for (const args of [["help"], ["--help"], ["-h"]]) {
      const result = await runCli(args, root);

      assert.equal(result.exitCode, 0, cliResultSummary(result));
      assert.equal(result.stderr, "");
      assert.match(result.stdout, /^smoque\n\nUsage:/u);
      assert.match(result.stdout, /smoque run \[suite-or-pattern\]/u);
      assert.match(result.stdout, /smoque snippets \[markdown-file-or-dir\]/u);
      assert.doesNotMatch(result.stdout, /Smoque/u);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque reports unknown commands and options", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-unknown-"));

  try {
    const unknownCommand = await runCli(["wat"], root);

    assert.equal(unknownCommand.exitCode, 2, cliResultSummary(unknownCommand));
    assert.match(unknownCommand.stderr, /Unknown command: wat/u);
    assert.match(unknownCommand.stdout, /^smoque\n\nUsage:/u);

    for (const [args, message] of [
      [["run", "--wat"], /Unknown smoque run option: --wat/u],
      [["list", "--wat"], /Unknown smoque list option: --wat/u],
      [["snippets", "--wat"], /Unknown smoque snippets option: --wat/u],
    ]) {
      const result = await runCli(args, root);

      assert.notEqual(result.exitCode, 0, cliResultSummary(result));
      assert.equal(result.stdout, "");
      assert.match(result.stderr, message);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque reports missing option values", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-missing-options-"));

  try {
    for (const [args, message] of [
      [["run", "--json"], /--json requires a value\./u],
      [["run", "--junit"], /--junit requires a value\./u],
      [["run", "--tag"], /--tag requires a tag\./u],
      [["run", "--skip-tag"], /--skip-tag requires a tag\./u],
      [["snippets", "--timeout"], /--timeout requires a value\./u],
    ]) {
      const result = await runCli(args, root);

      assert.notEqual(result.exitCode, 0, cliResultSummary(result));
      assert.equal(result.stdout, "");
      assert.match(result.stderr, message);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque reports unexpected positional arguments", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-unexpected-args-"));

  try {
    for (const [args, message] of [
      [["run", "first", "second"], /Unexpected smoque run argument: second/u],
      [["list", "first", "second"], /Unexpected smoque list argument: second/u],
      [["snippets", "first", "second"], /Unexpected smoque snippets argument: second/u],
    ]) {
      const result = await runCli(args, root);

      assert.notEqual(result.exitCode, 0, cliResultSummary(result));
      assert.equal(result.stdout, "");
      assert.match(result.stderr, message);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque rejects empty comma tag lists", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-empty-tags-"));

  try {
    for (const [args, message] of [
      [["run", "--tag", ","], /--tag requires at least one tag\./u],
      [["run", "--skip-tag", ", ,"], /--skip-tag requires at least one tag\./u],
      [["list", "--tag", ","], /--tag requires at least one tag\./u],
    ]) {
      const result = await runCli(args, root);

      assert.notEqual(result.exitCode, 0, cliResultSummary(result));
      assert.equal(result.stdout, "");
      assert.match(result.stderr, message);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run discovers smoke files and writes terminal, JSON, and JUnit output", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-run-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "package.smoke.ts"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("cli package smoke", async (t) => {
          const stepName: string = "passes";
          await t.step(stepName, () => undefined);
        });
      `,
      "utf8",
    );

    const result = await runCli(
      ["run", "--json", "smoke-report.json", "--junit", "smoke-report.xml"],
      root,
    );

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.match(result.stdout, /smoque/u);
    assert.match(result.stdout, /cli package smoke/u);
    assert.match(result.stdout, /PASS passes/u);

    const json = JSON.parse(await readFile(join(root, "smoke-report.json"), "utf8"));
    assert.equal(json.run.status, "passed");
    assert.equal(json.suites[0].name, "cli package smoke");

    const junit = await readFile(join(root, "smoke-report.xml"), "utf8");
    assert.match(junit, /<testsuite name="cli package smoke" tests="1" failures="0" skipped="0"/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque list discovers suites and prints their source files", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-list-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "api.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("api smoke", () => undefined);
        smoke.suite("api package smoke", { tags: ["package"] }, () => undefined);
      `,
      "utf8",
    );

    const result = await runCli(["list", "api"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^api smoke\tsmoke\/api\.smoke\.mjs\t-$/mu);
    assert.match(result.stdout, /^api package smoke\tsmoke\/api\.smoke\.mjs\tpackage$/mu);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque list matches suite name fragments", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-list-name-fragment-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "project.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("billing checkout flow", { tags: ["web"] }, () => undefined);
        smoke.suite("account settings flow", () => undefined);
      `,
      "utf8",
    );

    const result = await runCli(["list", "checkout"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^billing checkout flow\tsmoke\/project\.smoke\.mjs\tweb$/mu);
    assert.doesNotMatch(result.stdout, /account settings flow/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque list discovers TypeScript smoke files", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-list-ts-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "api.smoke.ts"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        const name: string = "api ts smoke";
        smoke.suite(name, () => undefined);
      `,
      "utf8",
    );

    const result = await runCli(["list", "api.smoke.ts"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^api ts smoke\tsmoke\/api\.smoke\.ts\t-$/mu);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque list source path fragments do not import unselected smoke files", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-list-path-import-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "good.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("good selected smoke", () => undefined);
      `,
      "utf8",
    );
    await writeFile(
      join(root, "smoke", "bad.smoke.mjs"),
      `
        throw new Error("unselected smoke file should not import");
      `,
      "utf8",
    );

    for (const pattern of ["./smoke/good.smoke.mjs", "good", "good.smoke", "smoke/good"]) {
      const result = await runCli(["list", pattern], root);

      assert.equal(result.exitCode, 0, cliResultSummary(result, pattern));
      assert.equal(result.stderr, "", pattern);
      assert.match(result.stdout, /^good selected smoke\tsmoke\/good\.smoke\.mjs\t-$/mu, pattern);
      assert.doesNotMatch(result.stdout, /unselected smoke file should not import/u, pattern);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque directory path patterns stay inside the selected directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-directory-path-import-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await mkdir(join(root, "examples"), { recursive: true });
    await writeFile(
      join(root, "smoke", "good.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("good directory smoke", async (t) => {
          await t.step("selected directory ran", () => undefined);
        });
      `,
      "utf8",
    );
    await writeFile(
      join(root, "examples", "bad.smoke.mjs"),
      `
        throw new Error("unselected example smoke should not import");
      `,
      "utf8",
    );

    const listed = await runCli(["list", "smoke/"], root);
    assert.equal(listed.exitCode, 0, cliResultSummary(listed));
    assert.equal(listed.stderr, "");
    assert.match(listed.stdout, /^good directory smoke\tsmoke\/good\.smoke\.mjs\t-$/mu);
    assert.doesNotMatch(listed.stdout, /unselected example smoke should not import/u);

    const ran = await runCli(["run", "smoke/"], root);
    assert.equal(ran.exitCode, 0, cliResultSummary(ran));
    assert.equal(ran.stderr, "");
    assert.match(ran.stdout, /good directory smoke/u);
    assert.match(ran.stdout, /PASS selected directory ran/u);
    assert.doesNotMatch(ran.stdout, /unselected example smoke should not import/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque list reports missing fragments clearly", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-list-missing-fragment-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "project.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("billing checkout flow", () => undefined);
      `,
      "utf8",
    );

    const result = await runCli(["list", "does-not-exist"], root);

    assert.equal(result.exitCode, 2, cliResultSummary(result));
    assert.match(result.stderr, /No smoke suites matched: does-not-exist/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque list filters suites by tag", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-list-tags-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "tagged.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("package smoke", { tags: ["package"] }, () => undefined);
        smoke.suite("slow package smoke", { tags: ["package", "slow"] }, () => undefined);
        smoke.suite("service smoke", { tags: ["service"] }, () => undefined);
      `,
      "utf8",
    );

    const result = await runCli(["list", "--tag", "package", "--skip-tag", "slow"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^package smoke\tsmoke\/tagged\.smoke\.mjs\tpackage$/mu);
    assert.doesNotMatch(result.stdout, /slow package smoke/u);
    assert.doesNotMatch(result.stdout, /service smoke/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run matches suite name fragments", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-run-name-fragment-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "project.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("billing checkout flow", async (t) => {
          await t.step("selected by name", () => undefined);
        });
        smoke.suite("account settings flow", () => {
          throw new Error("unselected suite should not run");
        });
      `,
      "utf8",
    );

    const result = await runCli(["run", "checkout"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /billing checkout flow/u);
    assert.match(result.stdout, /PASS selected by name/u);
    assert.doesNotMatch(result.stdout, /account settings flow/u);
    assert.doesNotMatch(result.stdout, /unselected suite should not run/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run source path fragments do not import unselected smoke files", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-run-path-import-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "good.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("good selected smoke", async (t) => {
          await t.step("selected file ran", () => undefined);
        });
      `,
      "utf8",
    );
    await writeFile(
      join(root, "smoke", "bad.smoke.mjs"),
      `
        throw new Error("unselected smoke file should not import");
      `,
      "utf8",
    );

    for (const pattern of ["smoke/good.smoke.mjs", "good", "good.smoke", "smoke/good"]) {
      const result = await runCli(["run", pattern], root);

      assert.equal(result.exitCode, 0, cliResultSummary(result, pattern));
      assert.equal(result.stderr, "", pattern);
      assert.match(result.stdout, /good selected smoke/u, pattern);
      assert.match(result.stdout, /PASS selected file ran/u, pattern);
      assert.doesNotMatch(result.stdout, /unselected smoke file should not import/u, pattern);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run filters suites by tag", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-run-tags-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "tagged.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("package smoke", { tags: ["package"] }, async (t) => {
          await t.step("selected", () => undefined);
        });
        smoke.suite("slow package smoke", { tags: ["package", "slow"] }, () => {
          throw new Error("slow suite should be skipped");
        });
        smoke.suite("service smoke", { tags: ["service"] }, () => {
          throw new Error("service suite should be skipped");
        });
      `,
      "utf8",
    );

    const result = await runCli(["run", "smoke/tagged.smoke.mjs", "--tag", "package", "--skip-tag", "slow"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /package smoke/u);
    assert.match(result.stdout, /PASS selected/u);
    assert.doesNotMatch(result.stdout, /slow suite should be skipped/u);
    assert.doesNotMatch(result.stdout, /service suite should be skipped/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run accepts mixed comma-separated tags", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-run-comma-tags-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "tagged.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("package smoke", { tags: ["package"] }, async (t) => {
          await t.step("selected package", () => undefined);
        });
        smoke.suite("service smoke", { tags: ["service"] }, async (t) => {
          await t.step("selected service", () => undefined);
        });
        smoke.suite("slow smoke", { tags: ["slow"] }, () => {
          throw new Error("slow suite should be skipped");
        });
      `,
      "utf8",
    );

    const result = await runCli(
      ["run", "smoke/tagged.smoke.mjs", "--tag", "package, service", "--skip-tag", "slow"],
      root,
    );

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /PASS selected package/u);
    assert.match(result.stdout, /PASS selected service/u);
    assert.doesNotMatch(result.stdout, /slow suite should be skipped/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run reports no tag matches clearly", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-run-no-tags-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "tagged.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("package smoke", { tags: ["package"] }, () => undefined);
      `,
      "utf8",
    );

    const result = await runCli(["run", "--tag", "missing"], root);

    assert.equal(result.exitCode, 2, cliResultSummary(result));
    assert.match(result.stderr, /No smoke suites matched the selected tag filters\./u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run ignores local artifact directories during discovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-run-ignored-dirs-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "good.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("visible smoke", async (t) => {
          await t.step("runs", () => undefined);
        });
      `,
      "utf8",
    );

    for (const directory of [".tmp", "coverage", ".idea", "__MACOSX"]) {
      await mkdir(join(root, directory), { recursive: true });
      await writeFile(
        join(root, directory, "ignored.smoke.mjs"),
        `
          throw new Error(${JSON.stringify(`${directory} smoke should not import`)});
        `,
        "utf8",
      );
    }

    const result = await runCli(["run"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /visible smoke/u);
    assert.match(result.stdout, /PASS runs/u);
    assert.doesNotMatch(result.stdout, /should not import/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run --update-snapshots writes text and directory snapshots", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-update-snapshots-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "snapshot.smoke.mjs"),
      `
        import { expect, smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("snapshot smoke", async (t) => {
          const generated = t.repoRoot().path("generated");
          await t.fs.mkdir(generated);
          await t.fs.writeText(t.repoRoot().path("generated", "output.txt"), "hello snapshot\\n");

          await expect.text("hello snapshot\\n").toMatchSnapshot(t.repoRoot().path("__snapshots__", "output.txt"));
          await expect.directory(generated).toMatchSnapshot(t.repoRoot().path("__snapshots__", "generated.json"), {
            checksum: true,
          });
        });
      `,
      "utf8",
    );

    const result = await runCli(["run", "--update-snapshots"], root);
    const directorySnapshot = JSON.parse(await readFile(join(root, "__snapshots__", "generated.json"), "utf8"));

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.equal(await readFile(join(root, "__snapshots__", "output.txt"), "utf8"), "hello snapshot\n");
    assert.deepEqual(
      directorySnapshot.entries.map((entry) => entry.path),
      ["output.txt"],
    );
    assert.equal(directorySnapshot.entries[0].checksum.algorithm, "sha256");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque list reports no tag matches clearly", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-list-no-tags-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "tagged.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("package smoke", { tags: ["package"] }, () => undefined);
      `,
      "utf8",
    );

    const result = await runCli(["list", "--tag", "missing"], root);

    assert.equal(result.exitCode, 2, cliResultSummary(result));
    assert.match(result.stderr, /No smoke suites matched the selected tag filters\./u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run resolves bundled runtime imports without project install", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-standalone-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(
      join(root, "smoke", "standalone.smoke.ts"),
      `
        import { expect, smoke, type SmokeContext } from "smoque";
        import { definePlugin } from "smoque/plugin";

        smoke.use(definePlugin({
          name: "fixture-plugin",
          register(registry) {
            registry.action("example.echo", (_t, value) => value);
          },
        }));

        smoke.suite("standalone bundled runtime smoke", async (t: SmokeContext & { example: { echo(value: string): Promise<string> } }) => {
          await t.step("standard primitives are available", () => {
            expect(typeof t.http.fakeServer).toBe("function");
          });

          await t.step("plugin subpath is available", async () => {
            expect(await t.example.echo("ok")).toBe("ok");
          });
        });
      `,
      "utf8",
    );

    const result = await runCli(["run"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /standalone bundled runtime smoke/u);
    assert.match(result.stdout, /PASS standard primitives are available/u);
    assert.match(result.stdout, /PASS plugin subpath is available/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run exits non-zero when a smoke suite fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-fail-"));

  try {
    await writeFile(
      join(root, "failure.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("cli failure smoke", async (t) => {
          await t.step("fails", () => {
            throw new Error("nope");
          });
        });
      `,
      "utf8",
    );

    const result = await runCli(["run"], root);

    assert.equal(result.exitCode, 1, cliResultSummary(result));
    assert.match(result.stdout, /FAIL fails/u);
    assert.match(result.stdout, /Failure: cli failure smoke > fails/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run --ci emits GitHub Actions annotations", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-ci-"));

  try {
    await writeFile(
      join(root, "failure.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("ci failure smoke", async (t) => {
          await t.step("fails loudly", () => {
            throw new Error("ci nope");
          });
        });
      `,
      "utf8",
    );

    const result = await runCli(["run", "--ci"], root);

    assert.equal(result.exitCode, 1, cliResultSummary(result));
    assert.match(result.stdout, /FAIL fails loudly/u);
    assert.match(
      result.stdout,
      /::error file=.*failure\.smoke\.mjs,title=ci failure smoke > fails loudly::Error: ci nope/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque run --keep-workdir-on-fail preserves failed fixture workdirs", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-keep-workdir-"));
  const marker = `kept for inspection ${Date.now()}`;
  const preservedRoots = [];

  try {
    await writeFile(
      join(root, "fixture.smoke.mjs"),
      `
        import { smoke } from ${JSON.stringify(coreUrl)};

        smoke.suite("fixture failure smoke", async (t) => {
          const work = await t.tempDir("package-fixture");

          await t.step("write fixture evidence", async () => {
            await t.fs.writeText(work.path("fixture", "debug.log"), ${JSON.stringify(marker)});
          });

          await t.step("fail after fixture setup", () => {
            throw new Error("fixture install failed");
          });
        });
      `,
      "utf8",
    );

    const result = await runCli(["run", "--keep-workdir-on-fail"], root);
    const preservedFiles = await findFiles(tmpdir(), "debug.log");
    const matchingFiles = [];
    for (const file of preservedFiles) {
      if ((await readFile(file, "utf8")) === marker) {
        matchingFiles.push(file);
        preservedRoots.push(dirname(dirname(file)));
      }
    }

    assert.equal(result.exitCode, 1, cliResultSummary(result));
    assert.match(result.stdout, /FAIL fail after fixture setup/u);
    assert.ok(matchingFiles.length > 0, "expected debug.log to be preserved");
  } finally {
    await rm(root, { recursive: true, force: true });
    await Promise.all(preservedRoots.map((path) => rm(path, { recursive: true, force: true })));
  }
});

test("smoque snippets runs marked markdown smoke blocks in isolated fixtures", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-snippets-"));

  try {
    await mkdir(join(root, "docs", "fixtures", "hello"), { recursive: true });
    await writeFile(join(root, "docs", "fixtures", "hello", "message.txt"), "hello docs\n", "utf8");
    await writeFile(
      join(root, "docs", "guide.md"),
      [
        "# Guide",
        "",
        "```ts",
        "throw new Error('ordinary docs block should not run');",
        "```",
        "",
        "## Happy Path",
        "",
        "```ts smoque fixture=fixtures/hello",
        'import { smoke, expect } from "smoque";',
        "",
        'smoke.suite("docs snippet passes", async (t) => {',
        '  await t.step("read fixture", async () => {',
        '    const message = await t.fs.readText(t.repoRoot().path("message.txt"));',
        '    expect(message).toBe("hello docs\\n");',
        "  });",
        "});",
        "```",
        "",
        "## Expected Failure",
        "",
        "```ts smoque expect-fail",
        'import { smoke } from "smoque";',
        "",
        'smoke.suite("docs expected failure", async (t) => {',
        '  await t.step("fail intentionally", () => {',
        '    throw new Error("expected docs failure");',
        "  });",
        "});",
        "```",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await runCli(["snippets", "docs/guide.md"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /smoque snippets/u);
    assert.match(result.stdout, /PASS docs\/guide\.md > Guide > Happy Path > line \d+/u);
    assert.match(result.stdout, /PASS docs\/guide\.md > Guide > Expected Failure > line \d+ \(expected failure\)/u);
    assert.match(result.stdout, /Result: passed 2 snippets/u);
    assert.doesNotMatch(result.stdout, /ordinary docs block should not run/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque snippets ignores local artifact directories during markdown discovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-snippets-ignored-dirs-"));

  try {
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(
      join(root, "docs", "guide.md"),
      [
        "# Guide",
        "",
        "```js smoque",
        "import { smoke } from 'smoque';",
        "smoke.suite('visible docs snippet', async (t) => {",
        "  await t.step('runs', () => undefined);",
        "});",
        "```",
        "",
      ].join("\n"),
      "utf8",
    );

    for (const directory of [".tmp", "coverage", ".idea", "__MACOSX"]) {
      await mkdir(join(root, directory), { recursive: true });
      await writeFile(
        join(root, directory, "ignored.md"),
        [
          "# Ignored",
          "",
          "```js smoque",
          "throw new Error('ignored markdown should not run');",
          "```",
          "",
        ].join("\n"),
        "utf8",
      );
    }

    const result = await runCli(["snippets", "."], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /PASS docs\/guide\.md > Guide > line 4/u);
    assert.match(result.stdout, /Result: passed 1 snippet/u);
    assert.doesNotMatch(result.stdout, /ignored markdown should not run/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque snippets fails when an expected failure snippet passes", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-snippets-unexpected-pass-"));

  try {
    await writeFile(
      join(root, "README.md"),
      [
        "# Snippets",
        "",
        "```ts smoque expect-fail",
        'import { smoke } from "smoque";',
        "",
        'smoke.suite("unexpected pass", async (t) => {',
        '  await t.step("passes", () => undefined);',
        "});",
        "```",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await runCli(["snippets", "README.md"], root);

    assert.equal(result.exitCode, 1, cliResultSummary(result));
    assert.match(result.stdout, /FAIL README\.md > Snippets > line \d+ \(expected failure passed\)/u);
    assert.match(result.stdout, /Source: README\.md > Snippets > line \d+/u);
    assert.match(result.stdout, /Result: failed 1 snippet/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque init writes a runnable smoke scaffold and smoke conventions", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-init-"));

  try {
    const result = await runCli(["init"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Created smoke\/project\.smoke\.ts/u);
    assert.match(result.stdout, /Created smoke\/AGENTS\.md/u);
    assert.match(result.stdout, /Next: smoque list/u);
    assert.match(result.stdout, /Next: smoque run/u);

    const smokeFile = await readFile(join(root, "smoke", "project.smoke.ts"), "utf8");
    assert.match(smokeFile, /import \{ smoke, type SmokeContext \} from "smoque";/u);
    assert.match(smokeFile, /smoke\.suite\("project smoke"/u);
    assert.match(
      smokeFile,
      /async function assertNodeAvailable\(t: SmokeContext\): Promise<void>/u,
    );

    const agents = await readFile(join(root, "smoke", "AGENTS.md"), "utf8");
    assert.match(agents, /^# Smoke Test Conventions/mu);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque init skips existing scaffold files unless forced", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-init-existing-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(join(root, "smoke", "project.smoke.ts"), "// Existing smoke\n", "utf8");
    await writeFile(join(root, "smoke", "AGENTS.md"), "# Existing agents\n", "utf8");

    const skipped = await runCli(["init"], root);

    assert.equal(skipped.exitCode, 0, cliResultSummary(skipped));
    assert.match(skipped.stdout, /Skipped smoke\/project\.smoke\.ts; already exists\./u);
    assert.match(skipped.stdout, /Skipped smoke\/AGENTS\.md; already exists\./u);
    assert.match(skipped.stdout, /Re-run with --force/u);
    assert.equal(
      await readFile(join(root, "smoke", "project.smoke.ts"), "utf8"),
      "// Existing smoke\n",
    );
    assert.equal(await readFile(join(root, "smoke", "AGENTS.md"), "utf8"), "# Existing agents\n");

    const forced = await runCli(["init", "--force"], root);

    assert.equal(forced.exitCode, 0, cliResultSummary(forced));
    assert.match(forced.stdout, /Wrote smoke\/project\.smoke\.ts/u);
    assert.match(forced.stdout, /Wrote smoke\/AGENTS\.md/u);
    assert.match(await readFile(join(root, "smoke", "project.smoke.ts"), "utf8"), /project smoke/u);
    assert.match(
      await readFile(join(root, "smoke", "AGENTS.md"), "utf8"),
      /^# Smoke Test Conventions/mu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque doctor reports local project readiness", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-doctor-"));

  try {
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "doctor-fixture" }), "utf8");
    await runCli(["init"], root);

    const result = await runCli(["doctor"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /smoque doctor/u);
    assert.match(result.stdout, /OK\s+node: v/u);
    assert.match(
      result.stdout,
      /OK\s+typescript smoke files: native (strip|transform) support on v\d+\.\d+\.\d+; \.smoke\.ts must use erasable TypeScript\./u,
    );
    assert.match(result.stdout, /OK\s+npm: \d/u);
    assert.match(result.stdout, /OK\s+package\.json: found doctor-fixture/u);
    assert.match(result.stdout, /OK\s+smoke files: 1 found\./u);
    assert.match(result.stdout, /OK\s+smoke\/AGENTS\.md: found\./u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque doctor warns when project scaffolding is missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-doctor-warn-"));

  try {
    const result = await runCli(["doctor"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.match(result.stdout, /WARN package\.json: not found/u);
    assert.match(result.stdout, /WARN smoke files: none found/u);
    assert.match(result.stdout, /WARN smoke\/AGENTS\.md: not found/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque doctor fails on invalid package metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-doctor-fail-"));

  try {
    await writeFile(join(root, "package.json"), "{ invalid json", "utf8");

    const result = await runCli(["doctor"], root);

    assert.equal(result.exitCode, 1, cliResultSummary(result));
    assert.match(result.stdout, /FAIL package\.json: invalid JSON\./u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque agents init writes smoke conventions", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-agents-"));

  try {
    const result = await runCli(["agents", "init"], root);

    assert.equal(result.exitCode, 0, cliResultSummary(result));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Created smoke\/AGENTS\.md/u);

    const agents = await readFile(join(root, "smoke", "AGENTS.md"), "utf8");
    assert.match(agents, /^# Smoke Test Conventions/mu);
    assert.match(agents, /Use `smoque`/u);
    assert.match(agents, /Name files `\*\.smoke\.ts`\./u);
    assert.match(agents, /Prefer `t\.cmd\(command, args\)` when arguments are known\./u);
    assert.match(agents, /Prefer fake HTTP servers over calls to real services\./u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque agents init refuses to overwrite unless forced", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-agents-existing-"));

  try {
    await mkdir(join(root, "smoke"), { recursive: true });
    await writeFile(join(root, "smoke", "AGENTS.md"), "# Existing\n", "utf8");

    const refused = await runCli(["agents", "init"], root);

    assert.equal(refused.exitCode, 2, cliResultSummary(refused));
    assert.match(refused.stderr, /already exists/u);
    assert.equal(await readFile(join(root, "smoke", "AGENTS.md"), "utf8"), "# Existing\n");

    const forced = await runCli(["agents", "init", "--force"], root);

    assert.equal(forced.exitCode, 0, cliResultSummary(forced));
    assert.match(forced.stdout, /Updated smoke\/AGENTS\.md/u);
    assert.match(
      await readFile(join(root, "smoke", "AGENTS.md"), "utf8"),
      /^# Smoke Test Conventions/mu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
