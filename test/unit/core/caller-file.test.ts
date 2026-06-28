import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { test } from "vitest";

import {
  extractStackFile,
  inferCallerFile,
  normalizeStackFile,
} from "../../../dist/core/context/caller-file.js";

test("caller-file inference restores Error.prepareStackTrace", () => {
  const original = Error.prepareStackTrace;
  const sentinel = () => "sentinel stack";
  Error.prepareStackTrace = sentinel;

  try {
    const file = inferCallerFile();

    assert.match(file, /caller-file\.test\.ts$/u);
    assert.equal(Error.prepareStackTrace, sentinel);
  } finally {
    Error.prepareStackTrace = original;
  }
});

test("caller-file helpers parse file URLs and stack file lines", () => {
  const fileUrl = pathToFileURL("/tmp/smoque caller/example smoke.mjs").href;

  assert.equal(normalizeStackFile(fileUrl), "/tmp/smoque caller/example smoke.mjs");
  assert.equal(extractStackFile(`    at smoke.suite (${fileUrl}:10:2)`), "/tmp/smoque caller/example smoke.mjs");
  assert.equal(extractStackFile("    at smoke.suite (/tmp/smoque/example.smoke.mjs:4:9)"), "/tmp/smoque/example.smoke.mjs");
  assert.equal(extractStackFile("    at native code"), undefined);
});
