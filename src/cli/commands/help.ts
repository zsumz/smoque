export function printHelp(): void {
    console.log(`smoque

Usage:
  smoque init
  smoque list [suite-or-pattern] [--tag tag] [--skip-tag tag]
  smoque run [suite-or-pattern] [--tag tag] [--skip-tag tag]
  smoque run --json smoke-results.json
  smoque run --junit smoke-results.xml
  smoque run --ci
  smoque run --keep-workdir-on-fail
  smoque run --update-snapshots
  smoque snippets [markdown-file-or-dir] [--timeout 30s]
  smoque doctor
  smoque agents init
  smoque --version
`);
}
