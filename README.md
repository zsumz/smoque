<br>

<p align="center">
  <img src="./smoque-logo.svg" alt="smoque" width="680">
</p>

<p align="center"><strong>every cookout needs a little smoke</strong></p>

# smoque

`smoque` is a small smoke-test runner for scripts, CLIs, packages, local services, and release artifacts.

## Install

```sh
npm install --save-dev smoque
```

## First Run

```sh
npx smoque init
npx smoque run smoke/
```

`init` creates `smoke/project.smoke.ts`, `smoke/AGENTS.md`,
`smoke/package.json`, and `smoke/tsconfig.json`.

## Example

```ts
import { smoke } from "smoque";

smoke.suite("project smoke", async (t) => {
  await t.step("node is available", async () => {
    await t.cmd("node", ["--version"]);
  });
});
```

## Built In

- commands, managed processes, ports, probes, files, fixtures, and safe workdirs
- HTTP requests, TLS, fake servers, captured requests, and network policy
- npm pack/install checks, archive assertions, snapshots, Compose, and Postgres
- terminal, JSON, JUnit, and GitHub Actions reporting
- tags, Markdown snippet checks, agent conventions, and custom plugins

## Commands

```sh
npx smoque init
npx smoque doctor
npx smoque list smoke/
npx smoque run smoke/
npx smoque run smoke/ --tag package
npx smoque run smoke/ --skip-tag package
npx smoque run smoke/ --json smoke-results.json
npx smoque run smoke/ --junit smoke-results.xml
npx smoque run smoke/ --ci
npx smoque run smoke/ --keep-workdir-on-fail
npx smoque run smoke/ --update-snapshots
npx smoque snippets README.md --timeout 30s
npx smoque agents init
npx smoque --version
```

## For Humans

Use smoque for checks that sit near the edge of the project:

- the CLI starts and returns useful output
- the package can be packed, installed, and imported
- a local service boots and answers a health check
- release artifacts are executable
- fake webhooks or test services receive the request you expected

## For Agents

- Run `npx smoque agents init` to add local smoke-test conventions.
- Prefer `t.cmd(command, args)` over shell strings when the arguments are known.
- Use `t.tempDir`, `t.workDir`, and built-in helpers.
- Includes files, ports, processes, HTTP, npm packages, archives, Compose, and Postgres.
- Keep smoke tests shallow. Prove one important path works.

## Guides

[Authoring](https://github.com/zsumz/smoque/blob/main/docs/authoring.md) · [Built-in integrations](https://github.com/zsumz/smoque/blob/main/docs/integrations.md) · [Automation](https://github.com/zsumz/smoque/blob/main/docs/automation.md) · [Examples](https://github.com/zsumz/smoque/tree/main/examples)

## Notes

Requires Node `22.18.0` or newer.

Linux and macOS are validated in CI. Windows build compatibility is checked; Windows runtime behavior remains experimental.
