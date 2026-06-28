import assert from "node:assert/strict";
import { test } from "vitest";

import {
  forceKillProcessTreeAfter,
  shouldUseProcessGroup,
  terminateProcessTree,
} from "../../../dist/process-tree.js";

test("shouldUseProcessGroup follows the current platform", async () => {
  await withPlatform("linux", async () => {
    assert.equal(shouldUseProcessGroup(), true);
  });

  await withPlatform("darwin", async () => {
    assert.equal(shouldUseProcessGroup(), true);
  });

  await withPlatform("win32", async () => {
    assert.equal(shouldUseProcessGroup(), false);
  });
});

test("terminateProcessTree ignores children that already exited", async () => {
  for (const child of [
    createFakeChild({ exitCode: 0 }),
    createFakeChild({ signalCode: "SIGTERM" }),
  ]) {
    await withProcessKill(() => {
      throw new Error("process.kill should not be called");
    }, async () => {
      child.kill = () => {
        throw new Error("child.kill should not be called");
      };

      terminateProcessTree(child, "SIGTERM");
    });
  }
});

test("terminateProcessTree sends signals to the process group on non-Windows platforms", async () => {
  const child = createFakeChild({ pid: 4321 });
  const calls = [];

  await withPlatform("linux", async () => {
    await withProcessKill((pid, signal) => {
      calls.push({ pid, signal });
      return true;
    }, async () => {
      terminateProcessTree(child, "SIGTERM");
    });
  });

  assert.deepEqual(calls, [{ pid: -4321, signal: "SIGTERM" }]);
  assert.deepEqual(child.signals, []);
});

test("terminateProcessTree falls back to child.kill when the process group is gone", async () => {
  const child = createFakeChild({ pid: 4321 });
  const calls = [];

  await withPlatform("linux", async () => {
    await withProcessKill((pid, signal) => {
      calls.push({ pid, signal });
      throw Object.assign(new Error("no such process"), { code: "ESRCH" });
    }, async () => {
      terminateProcessTree(child, "SIGTERM");
    });
  });

  assert.deepEqual(calls, [{ pid: -4321, signal: "SIGTERM" }]);
  assert.deepEqual(child.signals, ["SIGTERM"]);
});

test("terminateProcessTree rethrows unexpected process group failures", async () => {
  const child = createFakeChild({ pid: 4321 });
  const expected = Object.assign(new Error("permission denied"), { code: "EPERM" });

  await withPlatform("linux", async () => {
    await withProcessKill(() => {
      throw expected;
    }, async () => {
      assert.throws(() => terminateProcessTree(child, "SIGTERM"), expected);
    });
  });

  assert.deepEqual(child.signals, []);
});

test("terminateProcessTree falls back to child.kill when pid is unavailable", async () => {
  const child = createFakeChild({ pid: undefined });

  await withPlatform("linux", async () => {
    await withProcessKill(() => {
      throw new Error("process.kill should not be called");
    }, async () => {
      terminateProcessTree(child, "SIGTERM");
    });
  });

  assert.deepEqual(child.signals, ["SIGTERM"]);
});

test("terminateProcessTree uses child.kill on Windows platforms", async () => {
  const child = createFakeChild({ pid: 4321 });

  await withPlatform("win32", async () => {
    await withProcessKill(() => {
      throw new Error("process.kill should not be called");
    }, async () => {
      terminateProcessTree(child, "SIGTERM");
    });
  });

  assert.deepEqual(child.signals, ["SIGTERM"]);
});

test("forceKillProcessTreeAfter sends SIGKILL after the delay", async () => {
  const child = createFakeChild({ pid: 4321 });

  await withPlatform("win32", async () => {
    await withProcessKill(() => {
      throw new Error("process.kill should not be called");
    }, async () => {
      await forceKillProcessTreeAfter(child, 1);
    });
  });

  assert.deepEqual(child.signals, ["SIGKILL"]);
});

function createFakeChild(overrides = {}) {
  const child = {
    pid: 1234,
    exitCode: null,
    signalCode: null,
    signals: [],
    kill(signal) {
      child.signals.push(signal);
      return true;
    },
    ...overrides,
  };

  return child;
}

async function withProcessKill(replacement, callback) {
  const original = process.kill;
  process.kill = replacement;

  try {
    return await callback();
  } finally {
    process.kill = original;
  }
}

async function withPlatform(platform, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", {
    configurable: true,
    enumerable: descriptor.enumerable,
    value: platform,
  });

  try {
    return await callback();
  } finally {
    Object.defineProperty(process, "platform", descriptor);
  }
}
