import assert from "node:assert/strict";
import { beforeEach, test } from "vitest";

import { definePlugin, resetSmokeRegistry, runRegisteredSuites, smoke } from "../../../dist/core.js";

beforeEach(() => {
  resetSmokeRegistry();
});

test("plugin dotted actions and probes are exposed on the smoke context", async () => {
  smoke.use(
    definePlugin({
      name: "@example/context-plugin",
      register(registry) {
        registry.action("example.echo", (_t, value) => value);
        registry.probe("example.ready", (_t, message) => ({
          description: `example ready: ${message}`,
          async check() {
            return { ready: true, message: String(message) };
          },
        }));
      },
    }),
  );

  smoke.suite("plugin context", async (t) => {
    assert.equal(await t.example.echo("hello"), "hello");

    const probe = t.example.ready("yes");
    assert.equal(probe.description, "example ready: yes");
    assert.deepEqual(await probe.check(), { ready: true, message: "yes" });
    assert.equal(typeof t.log, "function");
    assert.equal(typeof t.log.contains, "function");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
});

test("plugin extension names cannot conflict with built-in context properties", () => {
  assert.throws(
    () =>
      smoke.use(
        definePlugin({
          name: "@example/conflict-plugin",
          register(registry) {
            registry.action("fs.readText", () => undefined);
          },
        }),
      ),
    /Plugin "@example\/conflict-plugin" registered action extension "fs\.readText" that conflicts with built-in context property "fs"/u,
  );
});

test("plugin extension names cannot be duplicated across plugins", () => {
  smoke.use(
    definePlugin({
      name: "@example/first-plugin",
      register(registry) {
        registry.action("example.echo", () => undefined);
      },
    }),
  );

  assert.throws(
    () =>
      smoke.use(
        definePlugin({
          name: "@example/second-plugin",
          register(registry) {
            registry.action("example.echo", () => undefined);
          },
        }),
      ),
    /Plugin "@example\/second-plugin" registered duplicate action extension "example\.echo"; already registered as action/u,
  );
});

test("plugin extension names cannot conflict across extension kinds", () => {
  assert.throws(
    () =>
      smoke.use(
        definePlugin({
          name: "@example/kind-conflict-plugin",
          register(registry) {
            registry.resource("example.client", () => ({ cleanup() {} }));
            registry.action("example.client", () => undefined);
          },
        }),
      ),
    /Plugin "@example\/kind-conflict-plugin" registered duplicate action extension "example\.client"; already registered as resource/u,
  );
});

test("plugin extension names cannot conflict with nested action prefixes", () => {
  assert.throws(
    () =>
      smoke.use(
        definePlugin({
          name: "@example/action-prefix-plugin",
          register(registry) {
            registry.action("example", () => undefined);
            registry.action("example.child", () => undefined);
          },
        }),
      ),
    /Plugin "@example\/action-prefix-plugin" registered action extension "example\.child" that conflicts with action extension "example"/u,
  );
});

test("plugin extension names cannot conflict with existing action leaves", () => {
  assert.throws(
    () =>
      smoke.use(
        definePlugin({
          name: "@example/action-leaf-plugin",
          register(registry) {
            registry.action("example.child", () => undefined);
            registry.action("example", () => undefined);
          },
        }),
      ),
    /Plugin "@example\/action-leaf-plugin" registered action extension "example" that conflicts with action extension "example\.child"/u,
  );
});

test("plugin extension names reject cross-kind prefix conflicts", () => {
  assert.throws(
    () =>
      smoke.use(
        definePlugin({
          name: "@example/resource-action-prefix-plugin",
          register(registry) {
            registry.resource("example.client", () => ({ cleanup() {} }));
            registry.action("example.client.query", () => undefined);
          },
        }),
      ),
    /Plugin "@example\/resource-action-prefix-plugin" registered action extension "example\.client\.query" that conflicts with resource extension "example\.client"/u,
  );

  assert.throws(
    () =>
      smoke.use(
        definePlugin({
          name: "@example/probe-action-prefix-plugin",
          register(registry) {
            registry.probe("example.ready.deep", () => ({
              description: "ready",
              async check() {
                return { ready: true };
              },
            }));
            registry.action("example.ready", () => undefined);
          },
        }),
      ),
    /Plugin "@example\/probe-action-prefix-plugin" registered action extension "example\.ready" that conflicts with probe extension "example\.ready\.deep"/u,
  );
});

test("plugin extension names reject unsafe dotted parts", () => {
  for (const name of ["__proto__.x", "constructor.x", "prototype.x", "example..x", ""]) {
    assert.throws(
      () =>
        smoke.use(
          definePlugin({
            name: `@example/invalid-${name || "empty"}`,
            register(registry) {
              registry.action(name, () => undefined);
            },
          }),
        ),
      /registered invalid action extension/u,
    );
  }
});

test("plugin resources are cleaned up automatically after success", async () => {
  const cleaned = [];

  smoke.use(
    definePlugin({
      name: "@example/resource-cleanup-plugin",
      register(registry) {
        registry.resource("example.client", () => ({
          name: "example-client",
          kind: "example.client",
          async cleanup() {
            cleaned.push("client");
          },
        }));
      },
    }),
  );

  smoke.suite("plugin resource success", async (t) => {
    await t.example.client();
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
  assert.deepEqual(cleaned, ["client"]);
});

test("plugin action-returned resources are cleaned up automatically after success", async () => {
  const cleaned = [];

  smoke.use(
    definePlugin({
      name: "@example/action-resource-cleanup-plugin",
      register(registry) {
        registry.action("example.client", () => ({
          name: "example-client",
          kind: "example.client",
          async cleanup() {
            cleaned.push("client");
          },
        }));
      },
    }),
  );

  smoke.suite("plugin action resource success", async (t) => {
    await t.example.client();
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
  assert.deepEqual(cleaned, ["client"]);
});

test("plugin resources attach on failure and clean up automatically", async () => {
  const attached = [];
  const cleaned = [];

  smoke.use(
    definePlugin({
      name: "@example/resource-failure-plugin",
      register(registry) {
        registry.resource("example.client", () => ({
          name: "example-client",
          kind: "example.client",
          async cleanup() {
            cleaned.push("client");
          },
          async attachOnFailure() {
            attached.push("client");
          },
        }));
      },
    }),
  );

  smoke.suite("plugin resource failure", async (t) => {
    await t.example.client();
    throw new Error("suite failed");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "failed");
  assert.equal(result.suites[0].error.message, "suite failed");
  assert.deepEqual(attached, ["client"]);
  assert.deepEqual(cleaned, ["client"]);
});

test("plugin action-returned resources attach on failure and clean up automatically", async () => {
  const attached = [];
  const cleaned = [];

  smoke.use(
    definePlugin({
      name: "@example/action-resource-failure-plugin",
      register(registry) {
        registry.action("example.client", () => ({
          name: "example-client",
          kind: "example.client",
          async cleanup() {
            cleaned.push("client");
          },
          async attachOnFailure() {
            attached.push("client");
          },
        }));
      },
    }),
  );

  smoke.suite("plugin action resource failure", async (t) => {
    await t.example.client();
    throw new Error("suite failed");
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "failed");
  assert.equal(result.suites[0].error.message, "suite failed");
  assert.deepEqual(attached, ["client"]);
  assert.deepEqual(cleaned, ["client"]);
});

test("plugin action-returned managed resources are not cleaned up twice", async () => {
  const cleaned = [];
  const resource = {
    name: "example-client",
    kind: "example.client",
    async cleanup() {
      cleaned.push("client");
    },
  };

  smoke.use(
    definePlugin({
      name: "@example/action-resource-single-cleanup-plugin",
      register(registry) {
        registry.resource("example.client", () => resource);
        registry.action("example.useClient", async (t) => await t.example.client());
      },
    }),
  );

  smoke.suite("plugin action managed resource", async (t) => {
    await t.example.useClient();
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "passed");
  assert.deepEqual(cleaned, ["client"]);
});

test("plugin resource cleanup errors are reported as cleanup errors", async () => {
  smoke.use(
    definePlugin({
      name: "@example/resource-cleanup-error-plugin",
      register(registry) {
        registry.resource("example.client", () => ({
          name: "example-client",
          kind: "example.client",
          async cleanup() {
            throw new Error("cleanup failed");
          },
        }));
      },
    }),
  );

  smoke.suite("plugin resource cleanup error", async (t) => {
    await t.example.client();
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "failed");
  assert.equal(result.suites[0].cleanupErrors[0].message, "cleanup failed");
});

test("plugin action-returned resource cleanup errors are reported as cleanup errors", async () => {
  smoke.use(
    definePlugin({
      name: "@example/action-resource-cleanup-error-plugin",
      register(registry) {
        registry.action("example.client", () => ({
          name: "example-client",
          kind: "example.client",
          async cleanup() {
            throw new Error("cleanup failed");
          },
        }));
      },
    }),
  );

  smoke.suite("plugin action resource cleanup error", async (t) => {
    await t.example.client();
  });

  const result = await runRegisteredSuites({ repoRoot: process.cwd() });

  assert.equal(result.status, "failed");
  assert.equal(result.suites[0].cleanupErrors[0].message, "cleanup failed");
});
