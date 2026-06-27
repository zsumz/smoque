export const smokeAgentsTemplate = `# Smoke Test Conventions

Use \`smoque\`.

## Structure

- Put smoke files under \`smoke/\`.
- Name files \`*.smoke.ts\`.
- Keep smoke-file TypeScript erasable so Node can strip types without a build step.
- Use \`smoke.suite("name", async (t) => { ... })\`.
- Wrap every meaningful action in \`await t.step("name", async () => { ... })\`.

## Commands

- Prefer \`t.cmd(command, args)\` when arguments are known.
- Use \`t.sh(script)\` only when shell behavior is intentional.
- Use \`check: false\` for commands expected to fail.

## Files and cleanup

- Use \`t.tempDir\` or \`t.workDir\` for temporary work.
- Never call \`rm -rf\` or \`fs.rm\` directly.
- Use \`t.fs.rm\` so unsafe paths are refused.

## Processes

- Use \`t.process.start\` for long-running processes.
- Always provide a readiness probe when possible.
- Do not manually spawn background processes.

## Waiting

- Use \`t.poll\` or probes instead of fixed sleeps.
- Timeouts should be explicit and small.

## Integrations

- Prefer fake HTTP servers over calls to real services.
- Do not send SMS, email, payments, or webhooks to real services in smoke tests.

## Assertions

- Smoke tests should be shallow.
- Prove one important path works.
- Do not duplicate unit/integration/E2E coverage.

## Debugging

- Attach useful logs and generated artifacts.
- Preserve workdirs on failure when they help debugging.
`;

export const initialSmokeTemplate = `import { smoke, type SmokeContext } from "smoque";

smoke.suite("project smoke", async (t) => {
  await t.step("node is available", async () => {
    await assertNodeAvailable(t);
  });
});

async function assertNodeAvailable(t: SmokeContext): Promise<void> {
  await t.cmd("node", ["--version"]);
}
`;
