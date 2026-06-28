import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "vitest";

import { createEnvReader } from "../../../dist/core/context/env-reader.js";

test("env reader handles optional, string, default, path, and redacted values", () => {
  withEnv({ SMOQUE_ENV_VALUE: "from-env", SMOQUE_ENV_PATH: "relative/path" }, () => {
    const redacted = [];
    const env = createEnvReader((value) => redacted.push(value));

    assert.equal(env.optional("SMOQUE_ENV_VALUE"), "from-env");
    assert.equal(env.optional("SMOQUE_MISSING"), undefined);
    assert.equal(env.string("SMOQUE_ENV_VALUE", { redact: true }), "from-env");
    assert.equal(env.string("SMOQUE_MISSING", { default: "fallback", redact: true }), "fallback");
    assert.equal(env.string("SMOQUE_MISSING"), "");
    assert.equal(env.path("SMOQUE_ENV_PATH").toString(), resolve("relative/path"));
    assert.equal(env.path("SMOQUE_MISSING", { default: "default/path" }).toString(), resolve("default/path"));
    assert.deepEqual(redacted, ["from-env", "fallback"]);
  });
});

test("env reader reports required string and path variables", () => {
  withEnv({}, () => {
    const env = createEnvReader();

    assert.throws(
      () => env.string("SMOQUE_REQUIRED_STRING", { required: true }),
      (error) => {
        assert.match(error.message, /Missing required environment variable: SMOQUE_REQUIRED_STRING/u);
        assert.equal(error.details.name, "SMOQUE_REQUIRED_STRING");
        return true;
      },
    );

    assert.throws(
      () => env.path("SMOQUE_REQUIRED_PATH", { required: true }),
      (error) => {
        assert.match(error.message, /Missing required environment variable: SMOQUE_REQUIRED_PATH/u);
        assert.equal(error.details.name, "SMOQUE_REQUIRED_PATH");
        return true;
      },
    );
  });
});

test("env reader parses integers strictly", () => {
  withEnv(
    {
      SMOQUE_INT: "42",
      SMOQUE_SIGNED_INT: "-7",
      SMOQUE_SPACED_INT: " 12 ",
      SMOQUE_PARTIAL_INT: "12abc",
      SMOQUE_FLOAT_INT: "1.5",
      SMOQUE_UNSAFE_INT: "9007199254740992",
    },
    () => {
      const env = createEnvReader();

      assert.equal(env.int("SMOQUE_INT"), 42);
      assert.equal(env.int("SMOQUE_SIGNED_INT"), -7);
      assert.equal(env.int("SMOQUE_SPACED_INT"), 12);
      assert.equal(env.int("SMOQUE_MISSING"), 0);
      assert.equal(env.int("SMOQUE_MISSING", { default: 5 }), 5);

      assert.throws(() => env.int("SMOQUE_PARTIAL_INT"), integerError("SMOQUE_PARTIAL_INT", "12abc"));
      assert.throws(() => env.int("SMOQUE_FLOAT_INT"), integerError("SMOQUE_FLOAT_INT", "1.5"));
      assert.throws(() => env.int("SMOQUE_UNSAFE_INT"), integerError("SMOQUE_UNSAFE_INT", "9007199254740992"));
    },
  );
});

test("env reader enforces integer requirements and bounds", () => {
  withEnv({ SMOQUE_SMALL: "2", SMOQUE_LARGE: "9" }, () => {
    const env = createEnvReader();

    assert.throws(
      () => env.int("SMOQUE_REQUIRED_INT", { required: true }),
      (error) => {
        assert.match(error.message, /Missing required environment variable: SMOQUE_REQUIRED_INT/u);
        assert.equal(error.details.name, "SMOQUE_REQUIRED_INT");
        return true;
      },
    );

    assert.throws(
      () => env.int("SMOQUE_SMALL", { min: 3 }),
      (error) => {
        assert.match(error.message, /Environment variable SMOQUE_SMALL must be at least 3\./u);
        assert.equal(error.details.name, "SMOQUE_SMALL");
        assert.equal(error.details.value, 2);
        return true;
      },
    );

    assert.throws(
      () => env.int("SMOQUE_LARGE", { max: 8 }),
      (error) => {
        assert.match(error.message, /Environment variable SMOQUE_LARGE must be at most 8\./u);
        assert.equal(error.details.name, "SMOQUE_LARGE");
        assert.equal(error.details.value, 9);
        return true;
      },
    );
  });
});

function integerError(name, value) {
  return (error) => {
    assert.match(error.message, new RegExp(`Environment variable ${name} must be an integer\\.`, "u"));
    assert.equal(error.details.name, name);
    assert.equal(error.details.value, value);
    return true;
  };
}

function withEnv(values, fn) {
  const previous = new Map();
  for (const name of Object.keys(values)) {
    previous.set(name, process.env[name]);
    process.env[name] = values[name];
  }

  const missingNames = [
    "SMOQUE_MISSING",
    "SMOQUE_REQUIRED_STRING",
    "SMOQUE_REQUIRED_PATH",
    "SMOQUE_REQUIRED_INT",
  ];

  for (const name of missingNames) {
    if (!previous.has(name)) {
      previous.set(name, process.env[name]);
    }
    delete process.env[name];
  }

  try {
    fn();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}
