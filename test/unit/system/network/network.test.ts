import assert from "node:assert/strict";
import { test } from "vitest";

import { assertNetworkAllowed, createNetApi } from "../../../../dist/network.js";

test("network policy blocks external hosts and allows configured hosts", () => {
  const context = {};
  const net = createNetApi(context);

  net.policy({ external: "block", allow: ["api.example.test"] });

  assert.doesNotThrow(() => {
    assertNetworkAllowed(context, "GET", "https://api.example.test/v1/health");
  });
  assert.doesNotThrow(() => {
    assertNetworkAllowed(context, "GET", "http://127.0.0.1:3000/health");
  });
  assert.doesNotThrow(() => {
    assertNetworkAllowed(context, "GET", "http://[::1]:3000/health");
  });

  assert.throws(
    () => {
      assertNetworkAllowed(context, "POST", "https://payments.example.test/charge");
    },
    (error) => {
      assert.match(error.message, /Blocked external network request: POST payments\.example\.test\/charge/u);
      assert.equal(error.details.method, "POST");
      assert.equal(error.details.host, "payments.example.test");
      assert.equal(error.details.path, "/charge");
      return true;
    },
  );
});
