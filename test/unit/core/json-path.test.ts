import assert from "node:assert/strict";
import { test } from "vitest";

import { readJsonPath } from "../../../dist/json-path.js";

test("readJsonPath reads simple dotted paths", () => {
  const value = {
    service: {
      status: "ok",
      nested: {
        count: 3,
      },
    },
  };

  assert.equal(readJsonPath(value, "$.service.status"), "ok");
  assert.equal(readJsonPath(value, "$.service.nested.count"), 3);
  assert.deepEqual(readJsonPath(value, "$.service"), value.service);
});

test("readJsonPath returns undefined through missing, null, and primitive cursors", () => {
  const value = {
    service: {
      nullable: null,
      label: "api",
    },
  };

  assert.equal(readJsonPath(value, "$.service.missing"), undefined);
  assert.equal(readJsonPath(value, "$.service.nullable.value"), undefined);
  assert.equal(readJsonPath(value, "$.service.label.length.value"), undefined);
});

test("readJsonPath rejects unsupported path syntax", () => {
  assert.throws(
    () => readJsonPath({ ok: true }, "service.status"),
    /Only simple \$\.path JSON paths are supported, got: service\.status/u,
  );
  assert.throws(
    () => readJsonPath({ ok: true }, "$[0]"),
    /Only simple \$\.path JSON paths are supported, got: \$\[0\]/u,
  );
});
