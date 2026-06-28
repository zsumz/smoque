import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { cliResultSummary, runCli } from "./helpers.js";

test("smoque snippets times out hanging snippets", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-snippets-timeout-"));

  try {
    await writeFile(
      join(root, "README.md"),
      [
        "# Docs",
        "",
        "## Hanging Example",
        "",
        "```js smoque",
        "import { smoke } from 'smoque';",
        "smoke.suite('hanging docs snippet', async () => {",
        "  setInterval(() => {}, 1000);",
        "  await new Promise(() => {});",
        "});",
        "```",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await runCli(["snippets", "README.md", "--timeout", "100ms"], root);

    assert.equal(result.exitCode, 1, cliResultSummary(result));
    assert.match(result.stdout, /FAIL README\.md > Docs > Hanging Example > line 6/u);
    assert.match(result.stdout, /Source: README\.md > Docs > Hanging Example > line 6/u);
    assert.match(result.stdout, /Timed out after 100ms/u);
    assert.match(result.stdout, /Result: failed 1 snippet/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("smoque snippets force kills snippets that ignore SIGTERM", async () => {
  const root = await mkdtemp(join(tmpdir(), "smoque-cli-snippets-force-kill-"));

  try {
    await writeFile(
      join(root, "README.md"),
      [
        "# Docs",
        "",
        "## Ignored Signal Example",
        "",
        "```js smoque",
        "import { smoke } from 'smoque';",
        "smoke.suite('ignores termination', async () => {",
        "  process.on('SIGTERM', () => {",
        "    setInterval(() => {}, 1000);",
        "  });",
        "  setInterval(() => {}, 1000);",
        "  await new Promise(() => {});",
        "});",
        "```",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await runCli(["snippets", "README.md", "--timeout", "100ms"], root);

    assert.equal(result.exitCode, 1, cliResultSummary(result));
    assert.match(result.stdout, /FAIL README\.md > Docs > Ignored Signal Example > line 6/u);
    assert.match(result.stdout, /Source: README\.md > Docs > Ignored Signal Example > line 6/u);
    assert.match(result.stdout, /Timed out after 100ms/u);
    assert.match(result.stdout, /Result: failed 1 snippet/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
