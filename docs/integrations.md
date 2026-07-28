# Built-in Integrations

The package root registers the standard integrations automatically. Import `smoke` from `smoque` and use them from the suite context.

| Context | What it proves |
| --- | --- |
| `t.npm` | pack a package, create an install fixture, inspect exports, bins, and installed metadata |
| `t.http` | make HTTP or HTTPS requests, assert responses, wait for readiness, and run fake servers |
| `t.archive` | list tar or zip contents for archive assertions |
| `t.compose` | check Docker Compose, start a project, resolve published ports, read logs, and clean up |
| `t.postgres` | check tools, connect to a database, or start a disposable Docker-backed database |

## Packages

`t.npm.pack()` returns the actual tarball and parsed package metadata. `t.npm.fixture()` creates an isolated package that can install the tarball with an explicit scripts, audit, funding, and lockfile policy.

Use archive and file-set expectations to prove that the artifact contains the public surface and excludes credentials or private files. See [node-package.smoke.ts](../examples/node-package.smoke.ts).

## HTTP and Fake Services

HTTP responses support status, header, body, and JSON-path expectations. Requests accept JSON, text, headers, timeouts, TLS options, and the suite network policy.

`t.http.fakeServer()` provides local routes, captured requests, response configuration, and request expectations. It is useful for webhooks and outbound integrations without a second service. See [fake-webhook.smoke.ts](../examples/fake-webhook.smoke.ts).

## Compose and Postgres

`t.compose.up()` returns a managed project. Resolve service URLs from published container ports instead of hard-coding host ports; cleanup brings the project down automatically.

`t.postgres.start()` creates a managed database through Docker. `t.postgres.connect()` uses an existing server. Both expose parameterized queries and SQL-file execution.

These integrations require their external tools only when invoked. `smoque doctor` checks Node, npm, the TypeScript runtime, smoke discovery, and agent conventions before a run.

## Custom Plugins

Use `definePlugin` from `smoque/plugin` to register namespaced actions, probes, recipes, or managed resources. Keep the plugin's context typing beside its implementation.

The registration pattern is in [plugin-authoring.ts](../examples/plugin-authoring.ts).
